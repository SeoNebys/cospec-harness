import { defineConfig, devices } from '@playwright/test';

// E2E runs the real server on a separate port (4100) with an isolated database
// file so it never touches the review app on port 4000 or its data.
const PORT = 4100;

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node server/index.js',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      BOOKMARKS_DB_PATH: '/tmp/bookmarks-e2e.db',
    },
  },
});
