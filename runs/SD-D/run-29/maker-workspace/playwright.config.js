import { defineConfig, devices } from '@playwright/test';

// E2E tests run against the app served at 127.0.0.1:4000 (VM capture address).
// Chromium comes from the shared install at /opt/playwright-browsers; no download.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start the app on a dedicated e2e port with an isolated data dir, so the run
  // never collides with the broker's port-4000 instance or the client's data.
  webServer: {
    command: 'PORT=4173 BM_DATA_DIR=/tmp/bm-e2e-data npm start',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
