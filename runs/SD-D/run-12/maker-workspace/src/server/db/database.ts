import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type AppDatabase = Database.Database;

export function openDatabase(filename = process.env.BOOKMARK_DB_PATH ?? resolve(process.cwd(), 'var/bookmarks.sqlite')): AppDatabase {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  if (filename !== ':memory:') db.pragma('journal_mode = WAL');
  return db;
}
