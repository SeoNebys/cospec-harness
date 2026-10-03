// Playwright config: run only the browser e2e specs (node:test owns the unit/integration tests).
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./test/e2e",
  timeout: 30000,
  use: { headless: true },
  reporter: [["list"]],
});
