import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4100;
const DATA_FILE = join(__dirname, "test", ".e2e-data.json");

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./test/global-setup.js",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node server.js",
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), DATA_FILE },
    stdout: "pipe",
    stderr: "pipe",
  },
});
