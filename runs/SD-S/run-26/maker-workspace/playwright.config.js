import { defineConfig } from '@playwright/test';

const PORT = 4100;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.js',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: 'npm start',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      PORT: String(PORT),
      BOOKMARKS_DB: '/tmp/bm-e2e/e2e.db',
    },
  },
});
