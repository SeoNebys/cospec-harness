import { defineConfig, devices } from '@playwright/test';

// Use the shared Chromium already installed in the image (revision matches
// playwright 1.61.0); do not download a second browser version.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
