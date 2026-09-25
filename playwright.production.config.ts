import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.HAWYA_PRODUCTION_URL ?? "https://hawya-studio.vercel.app";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "stage12-production-smoke.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "production-smoke-results",
  use: {
    baseURL,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
