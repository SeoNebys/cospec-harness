import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4100',
    headless: true,
  },
  webServer: {
    command: 'node src/server.js',
    url: 'http://127.0.0.1:4100',
    reuseExistingServer: false,
    env: { PORT: '4100', BOOKMARKS_DB: ':memory:' },
  },
});
