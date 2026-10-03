import type { DatabaseSync } from "node:sqlite";

export function initializeSchema(db: DatabaseSync) {
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY, url TEXT NOT NULL, normalized_url TEXT NOT NULL, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
      description TEXT CHECK(description IS NULL OR length(description) <= 1000), notes TEXT CHECK(notes IS NULL OR length(notes) <= 10000),
      site_icon_url TEXT, preview_image_url TEXT, favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
      reading_status TEXT NOT NULL DEFAULT 'to_read' CHECK(reading_status IN ('to_read','read')), archived_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookmark_tags (bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(bookmark_id,tag_id));
    CREATE INDEX IF NOT EXISTS idx_bookmarks_normalized_url ON bookmarks(normalized_url);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_scope ON bookmarks(archived_at, reading_status, favorite);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_updated ON bookmarks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id, bookmark_id);`);
}
