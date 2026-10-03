import { defineWorkspace } from 'vitest/config';
export default defineWorkspace([
  { test: { name: 'server', environment: 'node', include: ['apps/server/tests/**/*.test.ts'] } },
  { test: { name: 'web', environment: 'jsdom', include: ['apps/web/tests/**/*.test.ts?(x)', 'apps/web/tests/**/*.test.tsx'], setupFiles: ['apps/web/tests/setup.ts'] } }
]);
