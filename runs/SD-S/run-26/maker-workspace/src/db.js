// SQLite connection and schema (data-model.md).
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const DATA_DIR = path.join(ROOT, 'data');
export const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
export const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');
export const FAVICON_DIR = path.join(DATA_DIR, 'favicons');

for (const dir of [DATA_DIR, SNAPSHOT_DIR, THUMBNAIL_DIR, FAVICON_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const DB_PATH = process.env.BOOKMARKS_DB || path.join(DATA_DIR, 'bookmarks.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    normalized_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT,
    favicon_path TEXT,
    preview_image_path TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('read','unread')),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    snapshot_path TEXT,
    snapshot_type TEXT CHECK (snapshot_type IN ('webpage','pdf') OR snapshot_type IS NULL),
    snapshot_available INTEGER NOT NULL DEFAULT 0 CHECK (snapshot_available IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_normalized ON bookmarks(normalized_url);

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_lower TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
  );
`);

export default db;
