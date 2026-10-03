import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      { test: { name: 'component', environment: 'jsdom', include: ['tests/component/**/*.test.tsx'], setupFiles: ['tests/helpers/setup-dom.ts'] } },
      { test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], testTimeout: 15000 } }
    ],
    coverage: { reporter: ['text', 'html'], exclude: ['dist/**', 'tests/**'] }
  }
});
