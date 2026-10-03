import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  webServer: { command: 'npm start', url: 'http://127.0.0.1:4000/api/health', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:4000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
