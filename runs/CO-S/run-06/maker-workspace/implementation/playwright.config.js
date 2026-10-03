import { defineConfig } from "@playwright/test";

// Acceptance tests drive the real UI. A dedicated test server is started with
// TEST_MODE so metadata fetching is deterministic (no external network) and a
// throwaway data file is used.
export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4100",
    headless: true,
  },
  webServer: {
    command: "node test/e2e/server.fixture.js",
    url: "http://127.0.0.1:4100",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
