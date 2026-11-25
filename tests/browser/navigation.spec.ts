import { test, expect } from "@playwright/test";

test("workspace navigation preserves the shell, browser history and mobile access", async ({
  page,
}) => {
  const email = process.env.STUDYSYNC_TEST_EMAIL;
  const password = process.env.STUDYSYNC_TEST_PASSWORD;
  test.skip(!email || !password, "Requires a disposable study account.");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  await expect(nav).toBeVisible();
  const header = await page.locator("header.topbar").elementHandle();
  const sections = [
    "My subjects",
    "All materials",
    "My notes",
    "Reviewers",
    "Practice quizzes",
    "Settings",
  ];
  const heading = (name: string) =>
    page.getByRole("heading", { level: 1, name, exact: true });
  for (const section of sections) {
    await nav.getByRole("link", { name: section, exact: true }).click();
    await expect(heading(section)).toBeVisible();
    await expect(
      nav.getByRole("link", { name: section, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  expect(
    await header?.evaluate((el) => el === document.querySelector(".topbar")),
  ).toBe(true);
  await page.goBack();
  await expect(heading("Practice quizzes")).toBeVisible();
  await page.goForward();
  await expect(heading("Settings")).toBeVisible();

  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  for (const section of sections) {
    await menu.click();
    await nav.getByRole("link", { name: section, exact: true }).click();
    await expect(heading(section)).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
