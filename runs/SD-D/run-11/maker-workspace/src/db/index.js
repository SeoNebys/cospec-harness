import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses Node's built-in node:sqlite (DatabaseSync) rather than a native addon.
// This avoids the addon init/teardown assertion crash seen with better-sqlite3
// on this Node build, and needs no compilation or lockfile-pinned binary.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

export const DATA_DIR = path.join(ROOT, 'data');
export const PRESERVED_DIR = path.join(DATA_DIR, 'preserved');
const DB_PATH = path.join(DATA_DIR, 'bookmarks.db');

fs.mkdirSync(PRESERVED_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

// Bootstrap schema.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed the preferences singleton.
db.exec(
  `INSERT INTO preferences (id, default_sort, items_per_view, text_size)
   VALUES (1, 'date_added_desc', 25, 'medium')
   ON CONFLICT(id) DO NOTHING`
);

/** Run a function inside a transaction, rolling back on error. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

function closeDb() {
  try {
    db.close();
  } catch {
    /* already closed */
  }
}
process.on('exit', closeDb);
process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });

export default db;
