import { defineConfig, devices } from '@playwright/test';

const testDataDir=process.env.BOOKMARK_DATA_DIR || `/tmp/keepsake-e2e-${process.pid}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm start',
    env: { BOOKMARK_DATA_DIR: testDataDir },
    url: 'http://127.0.0.1:4000/api/health',
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'narrow-320', use: { browserName: 'chromium', viewport: { width: 320, height: 720 } } }
  ]
});
