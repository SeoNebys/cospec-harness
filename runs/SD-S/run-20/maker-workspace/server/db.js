import Database from 'better-sqlite3';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the database location. Tests pass BOOKMARKS_DB=':memory:' for an
// isolated ephemeral database; production defaults to a durable file on disk.
function resolveDbPath() {
  const configured = process.env.BOOKMARKS_DB;
  if (configured === ':memory:') return ':memory:';
  if (configured) return configured;
  return resolve(__dirname, '..', 'data', 'bookmarks.db');
}

let db;

// Open the database (once) and ensure the schema exists.
export function getDb() {
  if (db) return db;

  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  initSchema(db);
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
  `);
}
