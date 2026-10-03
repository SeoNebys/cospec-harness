import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'bookmarks.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'pagecopies'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function runMigrations() {
  const migDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
    db.exec(sql);
  }
  // Seed the single preferences row (id = 1) with defaults.
  db.prepare(
    `INSERT OR IGNORE INTO preferences (id, default_sort, page_size, text_size)
     VALUES (1, 'newest', 25, 'medium')`
  ).run();
}

runMigrations();

export const PAGECOPY_DIR = path.join(DATA_DIR, 'pagecopies');
export default db;
