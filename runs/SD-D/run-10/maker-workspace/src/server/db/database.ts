import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type AppDatabase = Database.Database;

export function openDatabase(databasePath: string): AppDatabase {
  const resolved = databasePath === ':memory:' ? databasePath : resolve(databasePath);
  if (resolved !== ':memory:') mkdirSync(dirname(resolved), { recursive: true });
  const database = new Database(resolved);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  return database;
}
