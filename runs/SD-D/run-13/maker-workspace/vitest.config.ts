import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['tests/fixtures/test-setup.ts'] } },
      { test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'contract', include: ['tests/contract/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'performance', include: ['tests/performance/**/*.test.ts'], environment: 'node' } }
    ]
  }
});
