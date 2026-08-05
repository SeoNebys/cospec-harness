import { defineConfig } from 'vitest/config';

// Unit + integration tests for the server. E2E lives under tests/e2e and runs
// via Playwright (npm run test:e2e), so it is excluded here.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
  },
});
