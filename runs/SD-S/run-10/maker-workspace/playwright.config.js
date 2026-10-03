import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against a fresh server instance on a dedicated port with
// a throwaway database (BOOKMARKS_DB), so they never touch the real data file.
const PORT = 4100;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node tests/e2e/server-fixture.js`,
    port: PORT,
    reuseExistingServer: false,
    env: { PORT: String(PORT) },
  },
});
