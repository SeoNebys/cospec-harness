import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4100',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'TROVE_DB_PATH=/tmp/trove-acceptance.sqlite TROVE_RESET_DB=1 TROVE_ENABLE_TEST_FIXTURES=1 PORT=4100 node implementation/server.js',
    cwd: '/work',
    url: 'http://127.0.0.1:4100/health',
    timeout: 20_000,
    reuseExistingServer: false
  }
});
