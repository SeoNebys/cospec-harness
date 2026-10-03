import { defineConfig, devices } from '@playwright/test';

// E2E config: drives Chromium against the app on 127.0.0.1:4000.
// A dedicated test server is started on a separate port via webServer to avoid
// clobbering a manually running review server; tests use baseURL below.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  // Single worker: all specs share one in-memory test server, so tests must not
  // run concurrently across files (each test resets state in beforeEach).
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4100',
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node server/index.js',
    url: 'http://127.0.0.1:4100/api/bookmarks',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: '4100',
      BOOKMARKS_DB: ':memory:',
    },
  },
});
