'use strict';
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const PORT = 4100;
const DB_FILE = path.join(__dirname, 'test', '.tmp', 'e2e.db');

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: require.resolve('./test/e2e/global-setup.js'),
  webServer: {
    command: 'node src/server.js',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 20000,
    env: { PORT: String(PORT), DB_FILE },
  },
});
