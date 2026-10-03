import { defineConfig } from '@playwright/test';

const PORT = 4090;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  webServer: {
    command: 'node src/server.js',
    url: `http://127.0.0.1:${PORT}/api/bookmarks`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      BOOKMARKS_TEST: '1',
      BOOKMARKS_DATA: './tests/e2e/.data.json',
    },
  },
});
