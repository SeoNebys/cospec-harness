import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../src/db/init.js';
import * as Bookmarks from '../../src/models/bookmark.js';
import { searchIds } from '../../src/services/search.js';

/** SC-004: search over ~1,000 bookmarks should feel immediate (<1s). */
describe('search performance', () => {
  it('searches 1,000 bookmarks well under a second', () => {
    const db = createTestDb();
    const now = new Date().toISOString();
    const topics = ['recipe', 'travel', 'work', 'music', 'code'];
    for (let i = 0; i < 1000; i++) {
      Bookmarks.create(db, {
        url: `https://example.com/page/${i}`,
        normalized_url: `https://example.com/page/${i}`,
        title: `Article ${i} about ${topics[i % topics.length]}`,
        tags: [topics[i % topics.length]],
        now,
      });
    }
    const start = performance.now();
    const ids = searchIds(db, 'tag:recipe OR travel', false);
    const elapsed = performance.now() - start;

    expect(ids.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
    db.close();
  });
});
