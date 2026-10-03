import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:4000/api/bookmarks',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_PATH: '.tmp/e2e.sqlite',
      PORT: '4000',
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
