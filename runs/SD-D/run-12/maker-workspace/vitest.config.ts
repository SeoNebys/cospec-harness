import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['tests/setup/vitest.setup.ts'],
    projects: [
      { test: { name: 'unit', environment: 'jsdom', include: ['tests/unit/**/*.test.{ts,tsx}'] } },
      { test: { name: 'integration', environment: 'node', include: ['tests/integration/**/*.test.ts'] } },
      { test: { name: 'performance', environment: 'node', include: ['tests/performance/**/*.test.ts'] } }
    ],
    coverage: { include: ['src/**/*.{ts,tsx}'], exclude: ['src/client/main.tsx', 'src/server/server.ts'] },
  },
});
