import { test, expect } from "@playwright/test";
import { office, pdf } from "../doc-fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`incorrect login is readable in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.route("**/auth/v1/token**", (route) => route.fulfill({
      status: 400,
      json: { error_code: "invalid_credentials", msg: "Invalid login credentials" },
    }));
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("student@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("incorrect-test-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const alert = page.locator("form").getByRole("alert");
    await expect(alert).toHaveText("Incorrect email or password. Check both and try again.");
    const contrast = await alert.evaluate((element) => {
      function luminance(rgb: string) {
        const [r, g, b] = rgb.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
          const channel = Number(value) / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      const style = getComputedStyle(element);
      const ink = luminance(style.color), surface = luminance(style.backgroundColor);
      return (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
}

test("public pages, email forms, and signed-out route protection", async ({
  page,
  request,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await request.post("/api/workspace/new-note", { data: {} })).status(),
  ).toBe(401);
  await page.goto("/");
  await page.getByRole("link", { name: "Create your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page.route("**/auth/v1/signup**", (r) =>
    r.fulfill({
      json: {
        id: crypto.randomUUID(),
        aud: "authenticated",
        email: "test@example.invalid",
        identities: [],
        user_metadata: {},
      },
    }),
  );
  await expect(page.getByRole("textbox", { name: /name/i })).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("test@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("study-testing-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("study-testing-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.reload();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("test@example.invalid");
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  await page.route("**/auth/v1/verify**", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      type: "email", email: "test@example.invalid", token: "01234567",
    });
    return route.fulfill({ status: 403, json: { error_code: "otp_expired", msg: "Token has expired or is invalid" } });
  });
  await page.getByLabel("Verification code").fill("0123 4567");
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("incorrect or has expired");
  await page.getByLabel("Email", { exact: true }).fill("other@example.invalid");
  await page.route("**/auth/v1/resend**", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ type: "signup", email: "other@example.invalid" });
    return route.fulfill({ json: {} });
  });
  await page.getByRole("button", { name: "Resend email" }).click();
  await expect(page.getByRole("status")).toContainText("new email");
  await expect(page.getByLabel("Verification code")).toHaveValue("");
  await page.goto("/login");
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({ status: 400, json: { error_code: "email_not_confirmed", msg: "Email not confirmed" } }),
  );
  await page.getByLabel("Email", { exact: true }).fill("pending@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("study-testing-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("pending@example.invalid");
  await page.goto("/forgot-password");
  await page.route("**/auth/v1/recover**", (r) => r.fulfill({ json: {} }));
  await page.getByLabel("Email", { exact: true }).fill("test@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account exists/)).toBeVisible();
  await page.goto("/auth/callback");
  await expect(
    page.getByRole("heading", { name: "This link is unavailable" }),
  ).toBeVisible();
});

test("authenticated study session persists through logout", async ({
  page,
}) => {
  const email = process.env.STUDYSYNC_TEST_EMAIL,
    password = process.env.STUDYSYNC_TEST_PASSWORD;
  test.skip(
    !email || !password,
    "Set disposable test account credentials to exercise hosted Auth and Storage.",
  );
  test.setTimeout(180000);
  const course = "Hydrology " + crypto.randomUUID().slice(0, 8);
  async function login() {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  await login();
  await page
    .getByRole("button", { name: "New subject", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject name").fill(course);
  await dialog.getByLabel("Subject code").fill("HYD-101");
  await dialog
    .getByRole("button", { name: "New subject", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: course })).toBeVisible();
  const subjectURL = page.url();
  const subject = subjectURL.split("/").pop()!;
  try {
    await page.getByRole("button", { name: "New note", exact: true }).click();
    await dialog.getByLabel("Note title").fill("Water cycle notes");
    await dialog.getByRole("button", { name: "New note", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Note content" });
    await editor.fill(
      "Liquid water becomes vapor through evaporation. Condensation forms clouds.",
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Saved" }),
    ).toBeVisible();
    await page.reload();
    await expect(editor).toContainText("Condensation forms clouds");
    const staleSave = await page.request.post("/api/workspace/save-note", {
      data: {
        id: page.url().split("/").pop(),
        title: "Stale title",
        revision: 0,
        content: { type: "doc", content: [] },
      },
    });
    expect(staleSave.status()).toBe(409);
    await page.goto(subjectURL);
    await page
      .getByRole("button", { name: "Upload materials", exact: true })
      .click();
    await dialog.locator("input[type=file]").setInputFiles([
      {
        name: "Lecture.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: office("docx"),
      },
      {
        name: "Slides.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        buffer: office("pptx"),
      },
      {
        name: "Reading.pdf",
        mimeType: "application/pdf",
        buffer: pdf("Liquid water becomes vapor through evaporation."),
      },
    ]);
    await dialog
      .getByRole("button", { name: "Upload materials", exact: true })
      .click();
    await expect(dialog).toBeHidden({ timeout: 40000 });
    await page
      .getByRole("navigation", { name: "Subject sections" })
      .getByRole("link", { name: "materials" })
      .click();
    await page.getByRole("link", { name: /Lecture.docx/ }).click();
    await expect(
      page.getByText(/Water moves through evaporation/),
    ).toBeVisible();
    await page.goto(subjectURL + "?tab=materials");
    await page.getByRole("link", { name: /Reading.pdf/ }).click();
    await expect(page.getByText("Page 1 / 1", { exact: true })).toBeVisible({
      timeout: 20000,
    });
    page.once("dialog", (prompt) => prompt.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/materials$/);
    await expect(page.getByRole("link", { name: /Reading\.pdf/ })).toHaveCount(
      0,
    );
    await page.goto(subjectURL);
    await page.getByRole("button", { name: "Generate reviewer" }).click();
    await dialog.getByRole("button", { name: "Generate reviewer" }).click();
    await expect(
      page.getByRole("heading", { name: "Water cycle reviewer" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save reviewer" }).click();
    await expect(page.getByText(/Saved reviewer/)).toBeVisible();
    await page.goto(subjectURL);
    await page.getByRole("button", { name: "Create quiz" }).click();
    await dialog.getByRole("button", { name: "Create practice quiz" }).click();
    await expect(
      page.getByRole("heading", { name: "Water cycle practice" }),
    ).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page
        .getByRole("radio")
        .nth(i === 0 ? 1 : 0)
        .check();
      if (i < 4)
        await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Submit quiz" }).click();
    await expect(
      page.getByRole("heading", { name: "4 / 5 correct" }),
    ).toBeVisible();
    await expect(page.getByText("Incorrect · Question 1")).toBeVisible();
    const resultUrl = page.url();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login();
    await page.goto(resultUrl);
    await expect(
      page.getByRole("heading", { name: "4 / 5 correct" }),
    ).toBeVisible();
  } finally {
    const result = await page.request.post("/api/workspace/delete", {
      data: { kind: "subjects", id: subject },
    });
    expect(
      result.ok(),
      "Temporary subject and uploaded files are removed",
    ).toBeTruthy();
  }
});
