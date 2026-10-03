import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bookmarks.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const globalDb = globalThis as unknown as { bookmarkDb?: Database.Database };
export const db = globalDb.bookmarkDb ?? new Database(dbPath);
if (process.env.NODE_ENV !== "production") globalDb.bookmarkDb = db;
db.pragma("journal_mode = WAL"); db.pragma("foreign_keys = ON"); db.pragma("busy_timeout = 5000");
export function migrate() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY, display_url TEXT NOT NULL, normalized_url TEXT NOT NULL UNIQUE, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300), description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000), icon_path TEXT, note_markdown TEXT NOT NULL DEFAULT '' CHECK(length(note_markdown)<=50000), note_plain TEXT NOT NULL DEFAULT '', is_read INTEGER NOT NULL DEFAULT 0, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS bookmark_tags (bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(bookmark_id,tag_id));
  CREATE INDEX IF NOT EXISTS bookmark_tags_reverse ON bookmark_tags(tag_id,bookmark_id);
  CREATE INDEX IF NOT EXISTS bookmarks_active_created ON bookmarks(archived_at,created_at DESC,id);
  CREATE INDEX IF NOT EXISTS bookmarks_read ON bookmarks(archived_at,is_read,created_at DESC,id);
  CREATE TABLE IF NOT EXISTS saved_searches (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, query_text TEXT NOT NULL, scope TEXT NOT NULL, read_filter TEXT NOT NULL, sort_key TEXT NOT NULL, parser_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK(id=1), default_sort TEXT NOT NULL DEFAULT 'newest', page_size INTEGER NOT NULL DEFAULT 25, text_size TEXT NOT NULL DEFAULT 'standard', updated_at TEXT NOT NULL);
  INSERT OR IGNORE INTO preferences(id,updated_at) VALUES(1,datetime('now'));
  `);
}
migrate();
