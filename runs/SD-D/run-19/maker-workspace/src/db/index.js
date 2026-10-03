import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

let db;

/** Resolve the database file path (overridable for tests / e2e). */
export function dbPath() {
  return process.env.BOOKMARKS_DB || 'data/bookmarks.db';
}

/** Get the shared connection, opening + configuring it on first use. */
export function getDb() {
  if (!db) {
    const path = dbPath();
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/** Apply all SQL migrations in order (idempotent). */
export function migrate(connection = getDb()) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    connection.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return connection;
}

/** Close and reset (used by tests). */
export function closeDb() {
  if (db) { db.close(); db = undefined; }
}
