import { defineConfig, devices } from '@playwright/test';

// E2E tests run against a locally started server. The shared image provides the
// browser binaries at /opt/playwright-browsers (PLAYWRIGHT_BROWSERS_PATH is set
// in the environment); pin @playwright/test to 1.61.0 to match that revision.
const PORT = process.env.E2E_PORT || 4100;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node src/server.js`,
    env: { PORT: String(PORT), DB_PATH: ':memory:' },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 20000,
  },
});
