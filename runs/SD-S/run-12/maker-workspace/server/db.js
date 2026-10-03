// SQLite connection + schema initialization (data-model.md).
// The database file lives under data/ by default; tests use an in-memory DB via
// the BOOKMARKS_DB env var.

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, '..', 'data', 'bookmarks.db');

/**
 * Open the database and ensure the schema exists.
 * @param {string} [dbPath] override path; use ':memory:' for tests.
 * @returns {import('better-sqlite3').Database}
 */
export function openDb(dbPath = process.env.BOOKMARKS_DB || DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      url          TEXT    NOT NULL,
      title        TEXT,
      notes        TEXT,
      date_added   TEXT    NOT NULL,
      date_updated TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );
  `);

  return db;
}
