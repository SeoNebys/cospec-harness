import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run db:reset:e2e && npm run db:migrate && npm run seed:review && npm run build && npm start",
    url: "http://127.0.0.1:4000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      HOST: "0.0.0.0",
      PORT: "4000",
      DATABASE_PATH: "/work/data/e2e.sqlite",
      BETTER_AUTH_SECRET: "e2e-bookmark-secret-at-least-thirty-two-characters",
      BETTER_AUTH_URL: "http://127.0.0.1:4000",
      BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:4000,http://maker:4000",
      REVIEW_MODE: "1",
    },
  },
});
