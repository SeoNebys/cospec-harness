import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests run in node; the markdown sanitize test opts into jsdom via a
    // per-file environment comment.
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/api/**/*.test.js'],
    setupFiles: ['tests/helpers/setup.js'],
    globals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    // better-sqlite3 (native addon) segfaults when many instances run across
    // parallel workers; run all files sequentially in a single fork, and expose
    // GC so the setup hook can finalize sqlite statements before process exit.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
});
