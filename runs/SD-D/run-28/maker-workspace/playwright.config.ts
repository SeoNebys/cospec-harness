import { defineConfig } from '@playwright/test';

// Uses the shared Chromium at /opt/playwright-browsers (set via env in CI/run).
export default defineConfig({
  testDir: './frontend/tests',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4000',
    headless: true,
  },
});
