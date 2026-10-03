import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DB = Database.Database;

let instance: DB | null = null;

/** Open (or create) the SQLite database and apply the schema idempotently. */
export function getDb(dbPath?: string): DB {
  if (instance && !dbPath) return instance;
  const path = dbPath ?? join(process.cwd(), 'data', 'bookmarks.db');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  // Ensure the single preferences row exists.
  db.prepare(
    `INSERT OR IGNORE INTO preferences (id, default_sort, items_shown, text_size)
     VALUES (1, 'date_added_desc', 25, 'medium')`,
  ).run();
  if (!dbPath) instance = db;
  return db;
}

/**
 * Keep the FTS index in sync for one bookmark, keyed by its integer rowid.
 * Indexes the EFFECTIVE display title/description (user override else captured).
 */
export function syncFts(db: DB, rowid: number): void {
  db.prepare('DELETE FROM bookmark_fts WHERE rowid = ?').run(rowid);
  const row = db
    .prepare(
      `SELECT rowid,
              COALESCE(title_user, title_captured, url) AS title,
              url,
              COALESCE(description_user, description_captured, '') AS description,
              COALESCE(note_md, '') AS note
       FROM bookmark WHERE rowid = ?`,
    )
    .get(rowid) as
    | { rowid: number; title: string; url: string; description: string; note: string }
    | undefined;
  if (!row) return;
  db.prepare(
    'INSERT INTO bookmark_fts (rowid, title, url, description, note) VALUES (?, ?, ?, ?, ?)',
  ).run(row.rowid, row.title, row.url, row.description, row.note);
}

export function removeFts(db: DB, rowid: number): void {
  db.prepare('DELETE FROM bookmark_fts WHERE rowid = ?').run(rowid);
}
