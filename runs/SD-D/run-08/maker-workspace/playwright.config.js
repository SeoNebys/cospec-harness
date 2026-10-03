import { defineConfig, devices } from '@playwright/test';

const PORT = 4100;

export default defineConfig({
  testDir: './backend/tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `PORT=${PORT} BOOKMARKS_DATA_DIR=./data-e2e node backend/src/server.js`,
    url: `http://127.0.0.1:${PORT}/api/preferences`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
