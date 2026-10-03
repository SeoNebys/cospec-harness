import { defineConfig } from "@playwright/test";
import { join } from "node:path";

const PORT = 4100;
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./test/acceptance",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    headless: true,
    actionTimeout: 8000,
  },
  webServer: {
    command: "node server.js",
    url: `${BASE}/api/bookmarks`,
    reuseExistingServer: false,
    timeout: 20000,
    env: {
      PORT: String(PORT),
      HOST: "127.0.0.1",
      BOOKMARKS_DATA: join(process.cwd(), "test", ".tmp", "e2e-data.json"),
      ALLOW_TEST_RESET: "1",
    },
  },
});
