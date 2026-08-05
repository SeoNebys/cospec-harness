import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, type DB } from '../../src/server/db/connection';
import { createBookmark, listBookmarks } from '../../src/server/db/queries';

// SC-002/SC-005: search/filter stays fast at ~500 bookmarks. Runs against an
// in-memory DB (no network). Threshold is generous to avoid CI flakiness while
// still catching an accidental O(n^2) regression.

let db: DB;

beforeEach(() => {
  db = openDb(':memory:');
  const tagPool = ['recipes', 'dinner', 'dessert', 'work', 'finance', 'travel', 'read'];
  for (let i = 0; i < 500; i++) {
    createBookmark(db, {
      url: `https://example${i}.com/page/${i}`,
      title: `Bookmark number ${i} about ${tagPool[i % tagPool.length]}`,
      notes: `Some notes for entry ${i}`,
      tags: [tagPool[i % tagPool.length], tagPool[(i + 1) % tagPool.length]],
    });
  }
});

afterEach(() => db.close());

describe('performance at 500 bookmarks (SC-002/SC-005)', () => {
  it('text search returns quickly', () => {
    const start = performance.now();
    const results = listBookmarks(db, { text: 'number 42' });
    const ms = performance.now() - start;
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(ms).toBeLessThan(100);
  });

  it('combined text + tag filter returns quickly', () => {
    const start = performance.now();
    const results = listBookmarks(db, {
      text: 'about',
      tagsAny: ['recipes', 'dinner'],
      tagsNot: ['dessert'],
    });
    const ms = performance.now() - start;
    expect(results.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(100);
  });
});
