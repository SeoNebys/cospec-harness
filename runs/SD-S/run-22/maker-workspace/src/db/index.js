import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// DB path is overridable via env so tests never touch the real database file.
const DB_PATH = process.env.BOOKMARKS_DB
  ? resolve(process.cwd(), process.env.BOOKMARKS_DB)
  : resolve(process.cwd(), 'data', 'bookmarks.db');

let db;

/**
 * Open (once) the SQLite database, applying the schema idempotently.
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}
