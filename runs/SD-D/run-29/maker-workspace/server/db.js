// SQLite persistence via Node's built-in node:sqlite (DatabaseSync). Opens
// (creating if needed) data/bookmarks.db and runs an idempotent schema migration.
// Single-user app, so no per-user tables.
//
// NOTE: The plan specified better-sqlite3, but that native binding aborts on
// process teardown/import in this Node 24.21 runtime. node:sqlite is the stable
// embedded synchronous SQLite engine here and keeps the same API shape.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// DATA_DIR defaults to <repo>/data; BM_DATA_DIR overrides it (used by tests to
// isolate their database from the client's real data).
const DATA_DIR = process.env.BM_DATA_DIR
  ? process.env.BM_DATA_DIR
  : join(__dirname, '..', 'data');
const SNAPSHOT_DIR = join(DATA_DIR, 'snapshots');

mkdirSync(SNAPSHOT_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'bookmarks.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    notes_html TEXT NOT NULL DEFAULT '',
    notes_text TEXT NOT NULL DEFAULT '',
    favicon_url TEXT,
    preview_image_url TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    saved_date INTEGER NOT NULL,
    updated_date INTEGER NOT NULL,
    offline_status TEXT NOT NULL DEFAULT 'pending',
    offline_kind TEXT,
    offline_path TEXT,
    ia_status TEXT NOT NULL DEFAULT 'none',
    ia_snapshot_url TEXT
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS saved_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    query TEXT NOT NULL DEFAULT '',
    include_tags TEXT NOT NULL DEFAULT '[]',
    exclude_tags TEXT NOT NULL DEFAULT '[]',
    created_date INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_sort TEXT NOT NULL DEFAULT 'date_added_desc',
    density TEXT NOT NULL DEFAULT 'comfortable',
    text_size TEXT NOT NULL DEFAULT 'medium'
  );

  INSERT OR IGNORE INTO preferences (id) VALUES (1);

  CREATE INDEX IF NOT EXISTS idx_bookmarks_state ON bookmarks(is_archived, is_read);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_saved ON bookmarks(saved_date);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title);
`);

// Wrap a function so it runs inside a transaction (node:sqlite has no helper).
// Reentrant: a transaction-wrapped function called from within another one runs
// inline on the existing transaction instead of issuing a nested BEGIN (which
// SQLite rejects).
let txDepth = 0;
export function transaction(fn) {
  return (...args) => {
    if (txDepth > 0) return fn(...args);
    txDepth++;
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    } finally {
      txDepth--;
    }
  };
}

export { db, DATA_DIR, SNAPSHOT_DIR };
