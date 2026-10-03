import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BookmarkDatabase } from '../../src/server/db/client.js';
import { openDatabase } from '../../src/server/db/client.js';
import { runMigrations } from '../../src/server/db/migrations.js';
import { BookmarkRepository } from '../../src/server/db/bookmark-repository.js';

let database: BookmarkDatabase;
let repository: BookmarkRepository;

beforeAll(() => {
  database = openDatabase(':memory:');
  runMigrations(database);
  const insertBookmark = database.prepare(`INSERT INTO bookmarks (url, normalized_url, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const insertTag = database.prepare('INSERT INTO tags (name, normalized_name) VALUES (?, ?)');
  const insertAssociation = database.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  const seed = database.transaction(() => {
    insertTag.run('Research', 'research');
    insertTag.run('Weekend', 'weekend');
    const timestamp = '2026-09-24T10:00:00.000Z';
    for (let index = 0; index < 10_000; index += 1) {
      const result = insertBookmark.run(
        `https://example.com/page-${index}`,
        `https://example.com/page-${index}`,
        index === 9_999 ? 'Needle design reference' : `Saved page ${index}`,
        index % 3 === 0 ? 'A practical library note' : null,
        timestamp,
        timestamp,
      );
      insertAssociation.run(result.lastInsertRowid, index % 2 === 0 ? 1 : 2);
    }
  });
  seed();
  repository = new BookmarkRepository(database);
});

afterAll(() => database.close());

describe('10,000 bookmark acceptance benchmark', () => {
  it('returns text and combined tag-filter results within two seconds', () => {
    const started = performance.now();
    const textResults = repository.list({ query: 'needle design' });
    const filteredResults = repository.list({ query: 'practical', tag: 'Research' });
    const elapsed = performance.now() - started;
    expect(textResults).toHaveLength(1);
    expect(filteredResults.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2_000);
  });
});
