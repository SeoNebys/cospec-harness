import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the data directory (holds the DB, snapshots, and cached images).
// Overridable via DATA_DIR so tests can use a throwaway location.
export const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', '..', '..', 'data');

let db;

export function getDb() {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = process.env.DB_PATH || join(DATA_DIR, 'app.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
