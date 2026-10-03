import { defineConfig, devices } from '@playwright/test';

// Pinned to Playwright 1.61.0 to match the preinstalled browser binaries.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
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
    timeout: 30_000,
    env: { BOOKMARKS_DB: 'data/e2e.db' },
  },
});
