import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    pool: 'forks',
  },
});
