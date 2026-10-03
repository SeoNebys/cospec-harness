import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './implementation/test/e2e',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4100', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node implementation/test/e2e/server.mjs',
    port: 4100,
    reuseExistingServer: false,
    env: { PORT: '4100', HOST: '127.0.0.1', KEEPWELL_DATA_FILE: '/tmp/keepwell-e2e-bookmarks.json' }
  },
});
