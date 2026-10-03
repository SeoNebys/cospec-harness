import Database from 'better-sqlite3';
import { DB_PATH, ensureDirs } from '../config';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    ensureDirs();
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// Used by tests to run against an isolated in-memory database.
export function setDbForTesting(instance: Database.Database): void {
  db = instance;
}
