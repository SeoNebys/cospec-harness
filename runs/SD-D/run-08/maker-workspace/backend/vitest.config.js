import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // vitest runs the pure-logic unit tests (no native modules). DB-backed tests live
    // under tests/node and run with the Node test runner to avoid a better-sqlite3
    // teardown segfault when the worker pool force-kills its child.
    include: ['tests/unit/**/*.test.js'],
  },
});
