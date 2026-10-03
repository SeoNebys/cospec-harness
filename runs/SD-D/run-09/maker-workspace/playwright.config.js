import { defineConfig } from '@playwright/test';

// Pinned to Playwright 1.61.0 to match the shared browser revision at
// /opt/playwright-browsers (no second browser download).
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    headless: true,
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4000',
    timeout: 60000,
    reuseExistingServer: true,
    env: { BOOKMARKS_DB: 'data/e2e.db' },
  },
});
