import { defineConfig } from '@playwright/test'

// End-to-end tests drive the real Electron app, so they need a display and the
// app built for the desktop runtime:
//   npm run rebuild && npm run build && npm run test:e2e
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list'
})
