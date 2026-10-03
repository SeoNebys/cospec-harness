import { defineConfig } from '@playwright/test';

// Pinned to the image's Playwright 1.61.0 / shared browsers. The e2e flow runs
// against a throwaway server the config starts on port 4100 so it never collides
// with the review server on 4000.
export default defineConfig({
  testDir: './tests',
  testMatch: /e2e\.spec\.js/,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4100',
    headless: true,
  },
  webServer: {
    command: 'node server/index.js',
    url: 'http://127.0.0.1:4100',
    reuseExistingServer: false,
    env: {
      PORT: '4100',
      BOOKMARKS_DB: ':memory:',
    },
  },
});
