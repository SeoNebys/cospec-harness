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
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/helpers/setup.ts']
        }
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts', 'tests/contract/**/*.test.ts'],
          environment: 'node'
        }
      }
    ]
  }
});
