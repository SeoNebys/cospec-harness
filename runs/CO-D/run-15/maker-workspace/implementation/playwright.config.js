import { defineConfig } from '@playwright/test';

const databasePath = `/tmp/stow-playwright-${process.pid}.db`;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    launchOptions: { executablePath: '/opt/playwright-browsers/chromium-1228/chrome-linux64/chrome' }
  },
  webServer: {
    command: 'node server.js',
    port: 4173,
    reuseExistingServer: false,
    env: {
      PORT: '4173',
      HOST: '127.0.0.1',
      STOW_DB_PATH: databasePath,
      STOW_EMAIL: 'owner@example.com',
      STOW_PASSWORD: 'secret',
      STOW_METADATA_FIXTURE_FILE: './test/fixtures/metadata.json'
    }
  }
});
