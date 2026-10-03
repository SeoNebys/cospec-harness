import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4000/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_PATH: "/work/data/e2e.db",
      BETTER_AUTH_SECRET: "e2e-secret-that-is-at-least-thirty-two-bytes",
      APP_BASE_URL: "http://127.0.0.1:4000",
      TRUSTED_ORIGIN: "http://127.0.0.1:4000",
      MAIL_TRANSPORT: "memory",
    },
  },
});
