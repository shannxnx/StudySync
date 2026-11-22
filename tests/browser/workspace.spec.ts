import { test, expect } from "@playwright/test";
import { office, pdf } from "../doc-fixtures";

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
  await page.getByLabel("Full name").fill("Test Student");
  await page.getByLabel("Email", { exact: true }).fill("test@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("study-testing-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Check your inbox" }),
  ).toBeVisible();
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
