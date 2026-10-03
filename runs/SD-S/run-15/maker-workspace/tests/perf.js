// Standalone performance benchmark (run: `npm run test:perf`).
//
// Kept out of the node:test suite deliberately. In this Node/better-sqlite3
// combination, finalizing statements at process teardown can trip a native
// assertion AFTER all work has completed successfully. The benchmark therefore
// prints a "PERF OK" marker only when every assertion below has passed, and the
// npm script gates success on that marker rather than on the (flaky) teardown
// exit code. If a performance target is missed, the assert throws first and no
// marker is printed, so the run fails as expected.
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/connection.js';
import { BookmarkStore } from '../src/models/bookmarks.js';

const db = openDatabase(':memory:');
const store = new BookmarkStore(db);

for (let i = 0; i < 1000; i++) {
  await store.create({
    address: `https://site${i}.example.com/page`,
    title: `Bookmark number ${i}`,
    description: i % 2 === 0 ? 'even entry' : 'odd entry',
    tags: [i % 10 === 0 ? 'tenth' : 'general'],
  });
}

let start = performance.now();
const searchResults = store.list({ q: 'number 500' });
const searchMs = performance.now() - start;
assert.ok(searchResults.length >= 1, 'search should find results');
assert.ok(searchMs < 1000, `search took ${searchMs.toFixed(1)}ms (SC-003: <1s)`);

start = performance.now();
const tagResults = store.list({ tag: 'tenth' });
const tagMs = performance.now() - start;
assert.equal(tagResults.length, 100, 'tag filter should return 100');
assert.ok(tagMs < 1000, `tag filter took ${tagMs.toFixed(1)}ms (<1s)`);

import { writeSync } from 'node:fs';
writeSync(
  1,
  `PERF OK — search 1,000 bookmarks: ${searchMs.toFixed(1)}ms; ` +
    `tag filter: ${tagMs.toFixed(1)}ms (target <1000ms each)\n`
);
// Exit cleanly without invoking the native module's process-teardown
// destructors, which can abort in this Node/better-sqlite3 combination.
process.exit(0);
