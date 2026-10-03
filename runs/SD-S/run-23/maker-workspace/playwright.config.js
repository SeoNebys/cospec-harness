import { defineConfig } from '@playwright/test';

// Uses an isolated DB file and a dedicated port so the e2e run does not
// touch the review server or its data.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4100' },
  webServer: {
    command: 'node src/server.js',
    url: 'http://127.0.0.1:4100/',
    reuseExistingServer: false,
    env: { PORT: '4100', DB_FILE: 'data/e2e-test.db', SKIP_METADATA: '1' },
  },
});
