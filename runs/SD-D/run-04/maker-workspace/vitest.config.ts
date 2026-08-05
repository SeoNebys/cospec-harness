import { defineConfig } from 'vitest/config';

// Unit + integration tests run under Node (backend logic + in-memory SQLite).
// E2E lives under tests/e2e and is run by Playwright, not Vitest.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  },
});
