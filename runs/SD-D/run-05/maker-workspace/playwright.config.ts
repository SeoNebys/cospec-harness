import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "tests/e2e", use: { baseURL: "http://127.0.0.1:4000" }, webServer: { command: "npm start", port: 4000, reuseExistingServer: true } });
