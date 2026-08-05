import { defineConfig } from '@playwright/test';

/**
 * E2E config. Boots two local servers before tests:
 *   1) the fixture web server (deterministic pages to bookmark), and
 *   2) the app itself — the backend serving the built frontend on one origin,
 *      pointed at a throwaway data directory.
 * Tests then drive a real browser through the app.
 */
const APP_PORT = 4501;
const FIXTURE_PORT = 4600;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `FIXTURE_PORT=${FIXTURE_PORT} node tests/fixtures/fixture-server.mjs`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/article`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Build the frontend, then run the backend (which serves it) on a test DB.
      command:
        'npm run build && cd ../backend && rm -rf .e2e-data && ' +
        `PORT=${APP_PORT} BOOKMARKS_DATA_DIR=./.e2e-data npx tsx src/server.ts`,
      url: `http://127.0.0.1:${APP_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
