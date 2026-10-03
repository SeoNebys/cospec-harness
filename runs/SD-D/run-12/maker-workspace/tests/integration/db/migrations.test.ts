import { afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../fixtures/database.js';

describe('database migrations', () => {
  let testDb: TestDatabase | undefined;
  afterEach(() => testDb?.cleanup());

  it('creates the schema idempotently with foreign keys and WAL enabled', () => {
    testDb = createTestDatabase();
    testDb.migrate();
    testDb.migrate();
    expect(testDb.db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(testDb.db.pragma('journal_mode', { simple: true })).toBe('wal');
    const tables = testDb.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).toEqual(expect.arrayContaining(['bookmarks', 'tags', 'bookmark_tags', 'icon_assets', 'schema_migrations']));
  });

  it('enforces bookmark and tag uniqueness', () => {
    testDb = createTestDatabase();
    testDb.migrate();
    const now = new Date().toISOString();
    const insert = testDb.db.prepare(`INSERT INTO bookmarks
      (url, normalized_url, title, is_favorite, is_unread, created_at, updated_at, url_search, title_search, description_search, notes_search)
      VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, '', '')`);
    insert.run('https://example.com/', 'https://example.com/', 'Example', now, now, 'https://example.com/', 'example');
    expect(() => insert.run('https://example.com/', 'https://example.com/', 'Again', now, now, 'https://example.com/', 'again')).toThrow();
  });
});
