import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: 'e2e.spec.js',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node implementation/server.js',
    cwd: '/work',
    url: 'http://127.0.0.1:4173/api/state',
    reuseExistingServer: false,
    timeout: 20_000,
    env: { ...process.env, PORT: '4173', NODE_ENV: 'test', DATA_FILE: '/tmp/keep-e2e-bookmarks.json' }
  }
});
