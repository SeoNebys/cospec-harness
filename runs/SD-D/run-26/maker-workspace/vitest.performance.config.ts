import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve('shared/src'),
      '@server': path.resolve('server/src'),
      '@client': path.resolve('client/src')
    }
  },
  test: {
    include: ['tests/performance/**/*.perf.test.ts'],
    environment: 'node',
    testTimeout: 90_000,
    fileParallelism: false
  }
});
