import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Allow tests to use an isolated / in-memory database via env override.
const DB_PATH = process.env.BOOKMARKS_DB_PATH
  ? process.env.BOOKMARKS_DB_PATH
  : join(__dirname, '..', 'data', 'bookmarks.db');

let db;

export function getDb() {
  if (db) return db;

  if (DB_PATH !== ':memory:') {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      title TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_bt_tag ON bookmark_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_bt_bookmark ON bookmark_tags(bookmark_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_address ON bookmarks(address);
  `);
}

// Test helper: reset the singleton so a fresh DB_PATH can be picked up.
export function _resetDbForTests() {
  if (db) {
    db.close();
    db = undefined;
  }
}
