import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'off',
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      PORT: '4000',
      BOOKMARKS_DB: ':memory:',
      ENABLE_TEST_RESET: '1',
    },
  },
});
