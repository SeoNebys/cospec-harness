import { defineConfig, devices } from '@playwright/test';

// Browser binaries are shared at /opt/playwright-browsers in this environment.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'off',
    ...devices['Desktop Chrome'],
  },
  // Start the app for e2e runs; reuse if already running.
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
