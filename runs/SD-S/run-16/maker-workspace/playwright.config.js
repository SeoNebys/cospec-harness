import { defineConfig } from '@playwright/test';

// The VM capture uses the 127.0.0.1 address; the app binds 0.0.0.0.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      // Point the e2e run at a throwaway DB and stub outbound metadata fetches.
      BOOKMARKS_DB: './data/e2e.db',
      METADATA_STUB: '1',
    },
  },
});
