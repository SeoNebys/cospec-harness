import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import Database from 'better-sqlite3';

import { migrateDatabase } from './migrate.js';

export type BookmarkDatabase = Database.Database;

export interface DatabaseOptions {
  path?: string;
  migrationsDirectory?: string;
}

export function openDatabase(options: DatabaseOptions = {}): BookmarkDatabase {
  const databasePath = options.path ?? process.env.DATABASE_PATH ?? 'data/bookmarks.sqlite';
  const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(databasePath);

  if (resolvedPath !== ':memory:') {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath, { timeout: 5_000 });
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  migrateDatabase(db, options.migrationsDirectory);
  return db;
}

export function closeDatabase(db: BookmarkDatabase): void {
  if (db.open) {
    db.close();
  }
}
