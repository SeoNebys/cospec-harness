import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4000", trace: "retain-on-failure" },
  webServer: { command: "npm start", url: "http://127.0.0.1:4000", reuseExistingServer: true, timeout: 120000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
