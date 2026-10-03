CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY, url TEXT NOT NULL, normalized_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 500),
  description TEXT CHECK(description IS NULL OR length(description)<=4000),
  note_markdown TEXT CHECK(note_markdown IS NULL OR length(note_markdown)<=100000),
  note_text TEXT NOT NULL DEFAULT '', read_status TEXT NOT NULL DEFAULT 'unread' CHECK(read_status IN ('unread','read')),
  archived_at TEXT, copy_status TEXT NOT NULL DEFAULT 'pending' CHECK(copy_status IN ('pending','available','failed')),
  copy_error_code TEXT, current_saved_copy_id TEXT, favicon_url TEXT, preview_image_url TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, url_revision INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bookmark_tags (bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(bookmark_id,tag_id));
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id,bookmark_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_active_created ON bookmarks(archived_at,created_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_read ON bookmarks(archived_at,read_status,created_at DESC,id);
