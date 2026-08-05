import { defineConfig } from '@playwright/test';

// End-to-end acceptance flows, one spec per user story (tests/e2e/usN-*.spec.ts).
// Assumes the app is running via `npm run dev` (Vite on 5173, backend on 8787).
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
