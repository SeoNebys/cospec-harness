import { defineConfig } from '@playwright/test';

// End-to-end config. Reuses the built app on port 4123 for tests.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4123',
    headless: true,
  },
  webServer: {
    command: 'PORT=4123 DATA_DIR=./data-e2e node dist/server/index.js',
    url: 'http://127.0.0.1:4123/api/health',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
