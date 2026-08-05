import { defineConfig } from '@playwright/test';

// End-to-end journey tests (save → find → open). Starts the local app on a test
// port and drives it in a real browser. Requires `npx playwright install` once.
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3100',
  },
  webServer: {
    command: 'PORT=3100 BOOKMARKS_DB=:memory: npm start',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
