/**
 * SQLite schema + migrations for the Bookmark Manager.
 * Entities per specs/001-bookmark-manager/data-model.md:
 * Bookmark, Tag, bookmark_tags, Snapshot, SavedSearch, Preferences.
 */
import type Database from 'better-sqlite3';

export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      url            TEXT    NOT NULL,
      normalized_url TEXT    NOT NULL UNIQUE,
      title          TEXT    NOT NULL DEFAULT '',
      description    TEXT    NOT NULL DEFAULT '',
      notes          TEXT    NOT NULL DEFAULT '',
      icon_ref       TEXT,
      preview_ref    TEXT,
      read_state     TEXT    NOT NULL DEFAULT 'read' CHECK (read_state IN ('to_read','read')),
      archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
      created_at     TEXT    NOT NULL,
      updated_at     TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      bookmark_id INTEGER NOT NULL UNIQUE REFERENCES bookmarks(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL CHECK (kind IN ('readable_page','pdf')),
      status      TEXT NOT NULL CHECK (status IN ('available','unavailable')),
      stored_path TEXT,
      captured_at TEXT NOT NULL,
      archive_url TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      query      TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      default_sort  TEXT NOT NULL DEFAULT 'newest' CHECK (default_sort IN ('newest','oldest','title')),
      text_size     TEXT NOT NULL DEFAULT 'normal' CHECK (text_size IN ('normal','large')),
      archive_optin INTEGER NOT NULL DEFAULT 0 CHECK (archive_optin IN (0,1))
    );

    INSERT OR IGNORE INTO preferences (id) VALUES (1);
  `);

  setupFts(db);
}

/**
 * FTS5 virtual table mirroring each bookmark's searchable text
 * (title, url, description, notes, and concatenated tag names),
 * kept in sync via triggers. Supports AND/OR/NOT/grouping/phrase (FR-013/015).
 */
function setupFts(db: Database.Database): void {
  // A standard (self-contained) FTS5 table: we index each bookmark explicitly by
  // rowid = bookmark id, and re-index on change. Supports delete/update by rowid.
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
      title, url, description, notes, tags
    );
  `);
}
