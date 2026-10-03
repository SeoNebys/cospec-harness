import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4000", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: { command: "npm start -- --hostname 0.0.0.0 --port 4000", url: "http://127.0.0.1:4000/login", reuseExistingServer: true, timeout: 120000 }
});
