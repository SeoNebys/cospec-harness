import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
export const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    url           TEXT NOT NULL,
    url_key       TEXT NOT NULL UNIQUE,
    domain        TEXT,
    title         TEXT DEFAULT '',
    description   TEXT DEFAULT '',
    favicon       TEXT DEFAULT '',
    preview_image TEXT DEFAULT '',
    notes         TEXT DEFAULT '',
    read_later    INTEGER NOT NULL DEFAULT 0,
    archived      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS saved_filters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    query      TEXT NOT NULL DEFAULT '',
    scope      TEXT NOT NULL DEFAULT 'active',
    sort       TEXT NOT NULL DEFAULT 'created_desc',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    image_file  TEXT,
    html_file   TEXT,
    title       TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preferences (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(archived);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_read_later ON bookmarks(read_later);
  CREATE INDEX IF NOT EXISTS idx_snapshots_bookmark ON snapshots(bookmark_id);
`);

export default db;
