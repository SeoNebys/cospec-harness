import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type AppDatabase = Database.Database;

export function databasePath(): string {
  return resolve(process.env.BOOKMARK_DB_PATH ?? 'data/bookmarks.sqlite');
}

export function openDatabase(path = databasePath()): AppDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('trusted_schema = OFF');
  return db;
}
