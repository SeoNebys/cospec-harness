import { defineConfig, devices } from '@playwright/test';

// Reuse the shared browser binaries provided by the image; never download a
// second revision (pinned to 1.61.0 to match /opt/playwright-browsers).
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/playwright-browsers';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node src/server.js',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: true,
    timeout: 30000,
    env: { BOOKMARKS_DB: 'data/e2e.db', PLAYWRIGHT_BROWSERS_PATH: '/opt/playwright-browsers' },
  },
});
