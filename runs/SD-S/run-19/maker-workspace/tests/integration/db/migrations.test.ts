import { afterEach, describe, expect, it } from 'vitest';
import type { BookmarkDatabase } from '../../../src/server/db/client.js';
import { openDatabase } from '../../../src/server/db/client.js';
import { runMigrations } from '../../../src/server/db/migrations.js';

let database: BookmarkDatabase | undefined;

afterEach(() => database?.close());

describe('database migrations', () => {
  it('is idempotent and creates the relational schema', () => {
    database = openDatabase(':memory:');
    runMigrations(database);
    runMigrations(database);
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).toEqual(expect.arrayContaining(['bookmarks', 'tags', 'bookmark_tags']));
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('cascades bookmark tag associations', () => {
    database = openDatabase(':memory:');
    runMigrations(database);
    database.prepare("INSERT INTO bookmarks (url, normalized_url, title, created_at, updated_at) VALUES ('https://e.test/', 'https://e.test/', 'E', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
    database.prepare("INSERT INTO tags (name, normalized_name) VALUES ('Research', 'research')").run();
    database.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (1, 1)').run();
    database.prepare('DELETE FROM bookmarks WHERE id = 1').run();
    expect(database.prepare('SELECT COUNT(*) AS count FROM bookmark_tags').get()).toEqual({ count: 0 });
  });
});
