import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Open (creating if needed) the SQLite database and apply the schema.
 * Pass a path or ':memory:' (used by tests); defaults to data/bookmarks.db.
 */
export function openDatabase(dbPath) {
  const target =
    dbPath || process.env.BOOKMARKS_DB || join(__dirname, '../../data/bookmarks.db');

  if (target !== ':memory:') {
    mkdirSync(dirname(target), { recursive: true });
  }

  const db = new Database(target);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}
