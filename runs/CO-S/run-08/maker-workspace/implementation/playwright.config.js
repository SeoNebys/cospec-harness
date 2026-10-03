'use strict';

const { defineConfig } = require('@playwright/test');

// Acceptance tests boot the real app on a dedicated port with a throwaway
// data file (set in the test), so they never touch production data.
module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4010',
    headless: true,
  },
  webServer: {
    command: 'node tests/e2e/server-under-test.js',
    url: 'http://127.0.0.1:4010/api/session',
    reuseExistingServer: false,
    timeout: 20000,
  },
});
