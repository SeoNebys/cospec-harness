import { defineConfig } from 'playwright/test';

const port = 4173;
const database = '/work/implementation/tests/.tmp/e2e.sqlite';

export default defineConfig({
  testDir: '.',
  testMatch: 'e2e.spec.js',
  globalSetup: './e2e.setup.js',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1400, height: 950 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: '/opt/playwright-browsers/chromium-1228/chrome-linux64/chrome'
    }
  },
  webServer: {
    command: 'node implementation/server.js',
    cwd: '/work',
    port,
    reuseExistingServer: false,
    timeout: 10_000,
    env: {
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      BOOKMARKS_DB: database,
      BOOKMARKS_METADATA_MODE: 'fixture'
    }
  }
});
