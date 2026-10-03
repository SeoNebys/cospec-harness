import { defineConfig } from '@playwright/test';

const DATA_DIR = process.env.E2E_DATA_DIR || '/tmp/bm-e2e-data';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.js',
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'off',
  },
  webServer: {
    command: `DATA_DIR=${DATA_DIR} PORT=4000 node server/src/index.js`,
    url: 'http://127.0.0.1:4000/api/preferences',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright-browsers',
    },
  },
});
