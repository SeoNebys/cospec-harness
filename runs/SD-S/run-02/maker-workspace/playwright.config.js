import { defineConfig } from '@playwright/test';

// E2E smoke config. Assumes the app is already running on port 4000
// (start it with `npm start` before `npm run test:e2e`).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
