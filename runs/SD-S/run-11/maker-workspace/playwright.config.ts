import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4000', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'mobile-320', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 700 } } },
  ],
  webServer: {
    command: 'npm start', url: 'http://127.0.0.1:4000', reuseExistingServer: !process.env.CI,
    env: { BOOKMARK_DATA_DIR: `/tmp/bookkeep-e2e-${process.pid}` }, timeout: 30_000,
  },
});
