import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.js',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4199',
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: '/opt/playwright-browsers/chromium-1228/chrome-linux64/chrome' }
  },
  webServer: {
    command: 'node implementation/server.js',
    cwd: '/work',
    port: 4199,
    timeout: 10_000,
    reuseExistingServer: false,
    env: { PORT: '4199', HOST: '127.0.0.1', KEEPWELL_DATA: '/tmp/keepwell-e2e-bookmarks.json' }
  }
});
