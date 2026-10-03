import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

// Resolve the database file location. Defaults to a local file under data/ so
// bookmarks persist across restarts (FR-005 / SC-004). Overridable via env for
// tests. Use ':memory:' for an ephemeral in-process database.
const DB_PATH = process.env.BOOKMARKS_DB || 'data/bookmarks.db';

let db;

export function getDb() {
  if (db) return db;

  if (DB_PATH !== ':memory:') {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);
  if (DB_PATH !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  db.exec('PRAGMA foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      url            TEXT NOT NULL,
      url_normalized TEXT NOT NULL UNIQUE,
      title          TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at
      ON bookmarks(created_at DESC);
  `);
}

// Run a function inside a transaction, committing on success and rolling back
// on error.
export function transaction(fn) {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

// Test helper: reset the singleton so a fresh DB is opened.
export function _resetDbForTests() {
  if (db) {
    db.close();
    db = undefined;
  }
}
