import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const E2E_PORT = 4123;
const E2E_DATA = path.join(os.tmpdir(), 'bm-e2e-data');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    // Reuse the shared Chromium; do not download a second browser.
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: {
    command: `node src/server/index.js`,
    url: `http://127.0.0.1:${E2E_PORT}/`,
    reuseExistingServer: false,
    timeout: 30000,
    env: { PORT: String(E2E_PORT), HOST: '127.0.0.1', DATA_DIR: E2E_DATA, DB_FILE: path.join(E2E_DATA, 'e2e.db') },
  },
});
