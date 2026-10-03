import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type BookmarkDatabase = Database.Database;

export function createDatabase(path: string): BookmarkDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { timeout: 5_000 });
  db.unsafeMode(false);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('trusted_schema = OFF');
  db.pragma('defensive = ON');
  return db;
}
