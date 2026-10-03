CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  url_original TEXT NOT NULL,
  url_normalized TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 1000),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 20000),
  icon_url TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1)),
  is_read INTEGER NOT NULL DEFAULT 1 CHECK(is_read IN (0,1)),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80),
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);
CREATE TABLE IF NOT EXISTS metadata_cache (
  url_normalized TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  title TEXT,
  description TEXT,
  icon_url TEXT,
  failure_code TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bulk_operations (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS bulk_operation_items (
  operation_id TEXT NOT NULL REFERENCES bulk_operations(id) ON DELETE CASCADE,
  bookmark_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_code TEXT,
  PRIMARY KEY (operation_id, bookmark_id)
);
CREATE VIRTUAL TABLE IF NOT EXISTS bookmark_search USING fts5(
  bookmark_id UNINDEXED, title, url, description, note, tags_text,
  tokenize='unicode61 remove_diacritics 2'
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_archive ON bookmarks(archived_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_read ON bookmarks(is_read);
CREATE INDEX IF NOT EXISTS idx_bookmarks_favorite ON bookmarks(is_favorite);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_updated ON bookmarks(updated_at DESC);
PRAGMA user_version = 1;
