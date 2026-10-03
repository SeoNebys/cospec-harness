// SQLite connection and idempotent schema initialisation (data-model.md).
// A single local database file provides persistence across restarts (FR-005).

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_DB_PATH = 'data/bookmarks.db';

let db;

/**
 * Open (once) and return the shared database connection, creating the schema if
 * it does not yet exist. Honours DB_PATH env var; ":memory:" is used by tests.
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || DEFAULT_DB_PATH;
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      url        TEXT    NOT NULL,
      title      TEXT    NOT NULL,
      notes      TEXT    NOT NULL DEFAULT '',
      url_key    TEXT    NOT NULL,
      created_at TEXT    NOT NULL,
      updated_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_url_key ON bookmarks(url_key);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);
  `);
}

/**
 * Test helper: reset the module-level connection (e.g. between test files).
 */
export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
