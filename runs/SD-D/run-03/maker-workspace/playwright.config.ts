import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4000/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: "4000",
      HOST: "0.0.0.0",
      DATABASE_PATH: "data/e2e.sqlite",
      NODE_ENV: "test",
    },
  },
});
