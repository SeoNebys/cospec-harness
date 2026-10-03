import { closeDatabase } from '../../src/server/db/connection.js';
import { runMigrations } from '../../src/server/db/migrations.js';
import { FIXED_NOW } from '../fixtures/bookmarks.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../fixtures/database.js';

interface TableListRow {
  name: string;
  strict: 0 | 1;
}

describe('database lifecycle', () => {
  let fixture: TemporaryDatabase | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  it('migrates an empty file into all strict tables and planned indexes', () => {
    fixture = createTemporaryDatabase({ migrate: false });
    expect(
      fixture.database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all(),
    ).toEqual([]);

    runMigrations(fixture.database, undefined, () => FIXED_NOW);

    const tables = fixture.database
      .prepare("SELECT name, strict FROM pragma_table_list WHERE name NOT LIKE 'sqlite_%'")
      .all() as TableListRow[];
    expect(tables).toEqual(
      expect.arrayContaining([
        { name: 'bookmarks', strict: 1 },
        { name: 'tags', strict: 1 },
        { name: 'bookmark_tags', strict: 1 },
        { name: 'schema_migrations', strict: 1 },
      ]),
    );

    const indexes = (
      fixture.database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>
    ).map(({ name }) => name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_bookmarks_url_key',
        'idx_bookmarks_reading_created',
        'idx_bookmarks_created',
        'idx_bookmark_tags_tag_bookmark',
      ]),
    );
    expect(
      fixture.database.prepare('SELECT * FROM schema_migrations').all(),
    ).toEqual([{ version: 1, name: 'initial', applied_at: FIXED_NOW }]);
  });

  it('is idempotent when migrations run again', () => {
    fixture = createTemporaryDatabase({ now: () => FIXED_NOW });
    runMigrations(fixture.database, undefined, () => '2099-01-01T00:00:00.000Z');

    expect(
      fixture.database.prepare('SELECT * FROM schema_migrations').all(),
    ).toEqual([{ version: 1, name: 'initial', applied_at: FIXED_NOW }]);
  });

  it('enforces foreign keys and cascades association deletion', () => {
    fixture = createTemporaryDatabase();
    const { database } = fixture;

    expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(() =>
      database
        .prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)')
        .run('missing-bookmark', 'missing-tag'),
    ).toThrow(/FOREIGN KEY constraint failed/);

    database
      .prepare(
        `INSERT INTO bookmarks
          (id, url, url_key, title, description, reading_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'bookmark-1',
        'https://example.com/',
        'https://example.com/',
        'Example',
        '',
        'untracked',
        FIXED_NOW,
        FIXED_NOW,
      );
    database
      .prepare('INSERT INTO tags (id, display_name, normalized_name) VALUES (?, ?, ?)')
      .run('tag-1', 'Research', 'research');
    database
      .prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)')
      .run('bookmark-1', 'tag-1');

    database.prepare('DELETE FROM bookmarks WHERE id = ?').run('bookmark-1');
    expect(database.prepare('SELECT * FROM bookmark_tags').all()).toEqual([]);
  });

  it('persists rows across close and reopen and configures each connection', () => {
    fixture = createTemporaryDatabase();
    fixture.database
      .prepare(
        `INSERT INTO bookmarks
          (id, url, url_key, title, description, reading_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'bookmark-1',
        'https://example.com/',
        'https://example.com/',
        'Persistent bookmark',
        '',
        'to_read',
        FIXED_NOW,
        FIXED_NOW,
      );
    closeDatabase(fixture.database);

    const reopened = fixture.openConnection();
    expect(reopened.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(reopened.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(
      reopened.prepare('SELECT title, reading_state FROM bookmarks').get(),
    ).toEqual({ title: 'Persistent bookmark', reading_state: 'to_read' });
    expect(reopened.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
      count: 1,
    });
  });
});
