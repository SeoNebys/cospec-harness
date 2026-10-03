import { defineConfig } from '@playwright/test';

// Use the shared browser binaries provided by the image (pinned 1.61.0).
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright-browsers';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    headless: true,
  },
  // Start the app for the smoke test and reuse it if already running.
  webServer: {
    command: 'node src/start.js',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
