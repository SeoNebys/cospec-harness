import { afterEach, afterAll } from 'vitest';

// The suite runs in a single shared worker context (isolate: false) to minimize
// native better-sqlite3 teardowns. Reset shared in-process module state between
// tests so nothing leaks across files (e.g. registered jobQueue handlers).
afterEach(async () => {
  try {
    const { _resetForTests } = await import('../../src/server/services/jobQueue.js');
    _resetForTests();
  } catch {
    /* ignore */
  }
});

afterAll(async () => {
  try {
    const { closeDb } = await import('../../src/server/db/connection.js');
    closeDb();
  } catch {
    /* ignore */
  }
});
