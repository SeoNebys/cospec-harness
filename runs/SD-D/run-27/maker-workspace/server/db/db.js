import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'app.db');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(join(DATA_DIR, 'preserved'), { recursive: true });

export const dataDir = DATA_DIR;
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema (idempotent)
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed preferences singleton
db.prepare(
  `INSERT INTO preferences (id, default_sort, items_per_page, text_size)
   VALUES (1, 'date_added', 25, 'medium')
   ON CONFLICT(id) DO NOTHING`
).run();

export default db;
