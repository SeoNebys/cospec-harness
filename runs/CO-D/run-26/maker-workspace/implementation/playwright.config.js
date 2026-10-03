import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const PORT = 4075;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bm-e2e-"));

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node server.js",
    env: { PORT: String(PORT), BM_DATA_DIR: DATA_DIR },
    url: `http://127.0.0.1:${PORT}/api/state`,
    reuseExistingServer: false,
    timeout: 20000,
  },
});
