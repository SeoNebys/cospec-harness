// T006: Open the SQLite database, apply the schema idempotently, seed preferences.
// Uses Node's built-in node:sqlite (Node 24) — no native build, stable teardown.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const dataDir = process.env.BM_DATA_DIR || join(repoRoot, 'data');
const dbPath = process.env.BM_DB_PATH || join(dataDir, 'bookmarks.db');

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const schema = readFileSync(join(here, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed the single preferences row (data-model.md: default_sort, page_size=25, text_size).
db.prepare(
  `INSERT OR IGNORE INTO preferences (id, default_sort, page_size, text_size)
   VALUES (1, 'date_added_desc', 25, 'medium')`
).run();

export const SNAPSHOT_DIR = join(dataDir, 'snapshots');
mkdirSync(SNAPSHOT_DIR, { recursive: true });

/** Run fn inside a transaction (node:sqlite has no .transaction helper). */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export default db;
