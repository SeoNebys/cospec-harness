import { defineConfig } from '@playwright/test';

// Acceptance tests run against a dedicated server instance on port 4011 with an
// isolated data directory, so they never touch the real app data.
export default defineConfig({
  testDir: './tests',
  testMatch: /acceptance\.spec\.mjs/,
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4011', headless: true },
  webServer: {
    command: 'PORT=4011 BOOKMARKS_DATA=.acceptance-data BOOKMARKS_OFFLINE=1 node server.js',
    url: 'http://127.0.0.1:4011/api/state',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
