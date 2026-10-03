const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4000', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:4000', reuseExistingServer: true, timeout: 15_000 }
});
