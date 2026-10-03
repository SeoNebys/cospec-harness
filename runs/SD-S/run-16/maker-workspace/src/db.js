import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Resolve the DB path (overridable for tests / e2e), ensure its directory exists.
const DB_PATH = process.env.BOOKMARKS_DB || './data/bookmarks.db';

let db;

export function getDb() {
  if (db) return db;

  if (DB_PATH !== ':memory:') {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  bootstrap(db);
  return db;
}

// Allow tests to inject an isolated in-memory database.
export function setDbForTesting(instance) {
  db = instance;
  db.pragma('foreign_keys = ON');
  bootstrap(db);
  return db;
}

function bootstrap(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      url                TEXT NOT NULL,
      normalized_url     TEXT NOT NULL UNIQUE,
      title              TEXT,
      description        TEXT,
      favicon_url        TEXT,
      preview_image_url  TEXT,
      notes              TEXT,
      enrichment_status  TEXT NOT NULL DEFAULT 'pending'
                         CHECK (enrichment_status IN ('pending', 'ready', 'failed')),
      date_saved         TEXT NOT NULL
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_normalized_url ON bookmarks(normalized_url);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_date_saved ON bookmarks(date_saved);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_id ON bookmark_tags(tag_id);
  `);
}
