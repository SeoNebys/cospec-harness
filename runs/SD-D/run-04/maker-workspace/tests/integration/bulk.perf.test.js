import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../../src/db/index.js';
import { createBookmark, bulkApply, bulkCount, list } from '../../src/models/bookmark.js';

// Large-collection bulk performance (SC-008; FR-025/027):
// "select all matching the complete current view" + apply a bulk action over a
// 5,000+ bookmark set completes well under 10 seconds and count == changed.
test('bulk over 5,000+ bookmarks is fast and exact (SC-008)', () => {
  const db = createTestDb();
  const N = 5000;
  const txn = db.transaction(() => {
    for (let i = 0; i < N; i++) {
      createBookmark(
        { url: `https://perf.example/item/${i}`, title: `t${i}`, tags: [i % 2 ? 'even0' : 'target'] },
        db
      );
    }
  });
  txn();

  const selector = { matching: { included_tags: ['target'], view: 'active' } };
  const expected = Math.ceil(N / 2);

  const start = Date.now();
  const count = bulkCount(selector, db);
  const changed = bulkApply(selector, { is_archived: true }, db);
  const elapsed = Date.now() - start;

  assert.equal(count, expected);
  assert.equal(changed, expected, 'affected count equals items changed');
  assert.ok(elapsed < 10000, `bulk took ${elapsed}ms, expected < 10000ms`);

  // The archived items are gone from the active view.
  assert.equal(list({ view: 'active', included_tags: ['target'] }, db).total, 0);
});
