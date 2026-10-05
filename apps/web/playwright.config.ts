import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: [["./e2e/support/safe-reporter.ts"]],
  outputDir: "../../output/playwright/p03",
  use: {
    browserName: "chromium",
    channel: "chromium",
    baseURL: "http://127.0.0.1:3103",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
});
