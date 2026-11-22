import { defineConfig } from "@playwright/test";
const port = process.env.STUDYSYNC_TEST_PORT || "3198";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 12000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:" + port,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    screenshot: "off",
    trace: "off",
  },
});
