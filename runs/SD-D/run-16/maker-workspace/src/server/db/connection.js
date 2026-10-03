// SQLite connection setup. Creates the data directory, opens the database,
// enables foreign keys and WAL mode, and runs migrations.
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { runMigrations } from './migrations.js';

let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.preservedDir, { recursive: true });
  db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

// For tests: close and reset the singleton.
export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
