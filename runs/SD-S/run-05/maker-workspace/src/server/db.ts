import Database from 'better-sqlite3';

export type DB = Database.Database;

// Opens (creating if needed) the local SQLite database and ensures the schema
// from specs/001-bookmark-manager/data-model.md exists. Pass ':memory:' for a
// throwaway database (tests). A single file makes backup a matter of copying it.
export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      url            TEXT NOT NULL,
      url_normalized TEXT NOT NULL,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      deleted_at     TEXT
    );

    -- Uniqueness of a normalized address applies only to active (non-deleted)
    -- bookmarks, so a deleted+re-saved address does not collide (FR-014).
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_url_active
      ON bookmarks (url_normalized) WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks (title);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks (created_at);

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    -- Tag names are unique case-insensitively (Work == work).
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name
      ON tags (lower(name));

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );
  `);
}
