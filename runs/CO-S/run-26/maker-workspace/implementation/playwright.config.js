import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

// Use the shared, pre-installed browser binaries.
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/playwright-browsers";

const APP_PORT = 4009; // distinct from the live app (4000) / prototype (4001)
const FIXTURE_PORT = 4100;
const DATA_FILE = path.join(os.tmpdir(), "bookmarks-acceptance.json");

export default defineConfig({
  testDir: "./test/acceptance",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node test/acceptance/fixture-server.js`,
      port: FIXTURE_PORT,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
      reuseExistingServer: false,
      stdout: "ignore",
    },
    {
      command: `node server.js`,
      port: APP_PORT,
      env: { PORT: String(APP_PORT), HOST: "127.0.0.1", DATA_FILE },
      reuseExistingServer: false,
      stdout: "ignore",
    },
  ],
});
