import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4000', headless: true },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:4000', reuseExistingServer: true }
});
