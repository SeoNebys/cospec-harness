import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Runs the core-logic tests (unit + integration) in plain Node — no Electron
// window needed — so saving, dedupe, metadata parsing, and listing can be
// verified headlessly.
export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') }
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: true
  }
})
