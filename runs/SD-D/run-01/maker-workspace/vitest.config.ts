import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@client': fileURLToPath(new URL('./src/client', import.meta.url)),
      '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  test: {
    coverage: { provider: 'v8', reportsDirectory: 'coverage' },
    projects: [
      { test: { name: 'node', environment: 'node', include: ['tests/{unit,integration,contract}/**/*.test.ts'] } },
      { test: { name: 'dom', environment: 'jsdom', setupFiles: ['tests/setup/dom.ts'], include: ['tests/component/**/*.test.tsx'] } },
    ],
  },
});
