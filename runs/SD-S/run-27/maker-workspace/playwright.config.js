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
    port: 4100,
    env: { PORT: '4100', BOOKMARKS_DB_PATH: '/work/data/e2e.db' },
    reuseExistingServer: false,
  },
});
