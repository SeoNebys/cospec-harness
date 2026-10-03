import { defineConfig } from "@playwright/test";

const PORT = process.env.ACCEPT_PORT || "4066";

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
  webServer: {
    command: "node server.js",
    port: Number(PORT),
    reuseExistingServer: false,
    env: {
      PORT,
      BM_TEST: "1",
      BM_ALLOW_LOCAL: "1",
      BM_DATA_DIR: "/tmp/bm-accept-data",
    },
  },
});
