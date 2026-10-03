import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['**/tests/**/*.test.{ts,tsx}'], setupFiles: ['./client/tests/setup.ts'], environmentMatchGlobs: [['client/tests/**','jsdom']] } });
