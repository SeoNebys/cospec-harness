import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.e2e.js',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4100',
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node src/server.js',
    port: 4100,
    reuseExistingServer: false,
    env: {
      PORT: '4100',
      HOST: '127.0.0.1',
      KEEPWELL_DB: './data/e2e.sqlite',
      KEEPWELL_TEST_MODE: '1',
    },
    timeout: 20_000,
  },
});
