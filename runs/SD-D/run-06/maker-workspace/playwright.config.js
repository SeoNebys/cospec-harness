import { defineConfig, devices } from '@playwright/test';

// Isolate e2e from the harness broker's app on port 4000: use a dedicated port
// and a fresh per-run database so the smoke test starts from an empty state.
const E2E_PORT = 4100;
const E2E_DB = `data/e2e-${Date.now()}.db`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  // One worker: all specs share a single server/DB, so run them sequentially
  // (each spec resets state in beforeEach) to keep them independent.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: `http://127.0.0.1:${E2E_PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(E2E_PORT),
      BOOKMARKS_DB: E2E_DB,
      // Keep e2e fast and network-independent; async capture is covered elsewhere.
      DISABLE_CAPTURE: '1',
    },
  },
});
