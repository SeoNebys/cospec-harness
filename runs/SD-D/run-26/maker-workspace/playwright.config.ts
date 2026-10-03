import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4000/health/ready',
    reuseExistingServer: true,
    timeout: 30_000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
        executablePath: '/opt/playwright-browsers/chromium-1228/chrome-linux64/chrome'
      }
    },
    {
      name: 'mobile-accessibility',
      testMatch: /accessibility\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        channel: undefined,
        executablePath: '/opt/playwright-browsers/chromium-1228/chrome-linux64/chrome'
      }
    }
  ]
});
