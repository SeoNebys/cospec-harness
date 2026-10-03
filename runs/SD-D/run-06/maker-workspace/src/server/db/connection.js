import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Resolve the database path. Overridable for tests / e2e via BOOKMARKS_DB.
const DB_PATH = process.env.BOOKMARKS_DB || 'data/bookmarks.db';

let db;

export function getDb() {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function getDbPath() {
  return DB_PATH;
}

// Test helper: close and reset the singleton so a fresh path can be opened.
export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
