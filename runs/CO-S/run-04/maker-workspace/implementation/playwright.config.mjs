import { defineConfig, devices } from "@playwright/test";

// Acceptance tests run against the real server on a dedicated test port.
// The /api/metadata endpoint is stubbed per-test via page.route so tests never
// depend on the public internet.
const PORT = 4100;

export default defineConfig({
  testDir: "./tests/acceptance",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "node server.mjs",
    env: { PORT: String(PORT), HOST: "127.0.0.1" },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 20000,
  },
});
