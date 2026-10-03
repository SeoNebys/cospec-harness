// Central data store (SQLite via Node's built-in node:sqlite).
// Being server-side, this is the single source of truth that lets a user's
// bookmarks and preferences follow them across devices (SCN: cross-device sync).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.BM_DATA_DIR || join(here, "..", "data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, "app.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prefs (
    user_id TEXT PRIMARY KEY, sort TEXT NOT NULL, page_size INTEGER NOT NULL, text_size TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    url TEXT NOT NULL, norm TEXT NOT NULL,
    title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    icon_letter TEXT, icon_color TEXT, preview_label TEXT, preview_color TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT '',
    to_read INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    snap_kind TEXT, snap_captured_at INTEGER, snap_content TEXT, snap_mime TEXT, snap_pdf BLOB,
    archive_url TEXT, archived_at INTEGER,
    saved_at INTEGER NOT NULL, edited_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_bm_user ON bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_bm_user_norm ON bookmarks(user_id, norm);
  CREATE TABLE IF NOT EXISTS views (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
    query TEXT NOT NULL DEFAULT '', include_json TEXT NOT NULL DEFAULT '[]',
    exclude_json TEXT NOT NULL DEFAULT '[]', filter TEXT NOT NULL DEFAULT 'all',
    sort TEXT NOT NULL DEFAULT 'added-desc', created_at INTEGER NOT NULL
  );
`);

export default db;
