import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Data directory: overridable for tests via BOOKMARKS_DATA_DIR.
export const DATA_DIR =
  process.env.BOOKMARKS_DATA_DIR || path.resolve(__dirname, '../../../data');
export const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');

fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// Tests may request an in-memory DB (BOOKMARKS_DB_MEMORY=1) so the native handle
// tears down cleanly under the test runner.
const dbPath =
  process.env.BOOKMARKS_DB_MEMORY === '1' ? ':memory:' : path.join(DATA_DIR, 'app.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Apply schema idempotently.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Prepared-statement cache. better-sqlite3's Statement finalizer crashes Node's GC
// (RemoveEnvironmentCleanupHook assertion) when many transient statements are
// collected, so every statement is prepared once and retained here. This also makes
// repeated queries faster.
const stmtCache = new Map();
export function stmt(sql) {
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}

// Seed singleton preferences row.
stmt(
  `INSERT OR IGNORE INTO preferences (id, default_sort, items_per_page, font_size)
   VALUES (1, 'created_desc', 25, 'medium')`
).run();

export default db;
