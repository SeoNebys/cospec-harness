import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:4000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      BOOKMARK_DB_PATH: 'data/e2e-bookmarks.db',
      METADATA_TEST_MODE: '1',
    },
  },
});
