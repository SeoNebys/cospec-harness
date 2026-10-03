import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const APP_PORT = 4010;
const FIXTURES_PORT = 4020;
const DATA_FILE = path.join(os.tmpdir(), `bookmarks-e2e-${process.pid}.json`);

export default defineConfig({
  testDir: './tests/acceptance',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'off'
  },
  webServer: [
    {
      command: `node tests/fixtures/server.mjs`,
      port: FIXTURES_PORT,
      env: { FIXTURES_PORT: String(FIXTURES_PORT) },
      reuseExistingServer: false
    },
    {
      command: `node server.js`,
      port: APP_PORT,
      env: {
        PORT: String(APP_PORT),
        BOOKMARKS_DATA_FILE: DATA_FILE,
        ALLOW_TEST_RESET: '1'
      },
      reuseExistingServer: false
    }
  ]
});

export { APP_PORT, FIXTURES_PORT };
