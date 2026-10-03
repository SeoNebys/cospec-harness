import { defineConfig } from '@playwright/test';

// Uses the shared Chromium at /opt/playwright-browsers (pinned to 1.61.0).
// Do not download a second browser revision.
export default defineConfig({
  testDir: '.',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    headless: true,
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
