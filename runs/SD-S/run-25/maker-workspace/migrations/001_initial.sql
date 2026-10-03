CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 4096),
  url_key TEXT NOT NULL CHECK(length(url_key) BETWEEN 1 AND 4096),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 2000),
  reading_state TEXT NOT NULL DEFAULT 'untracked'
    CHECK(reading_state IN ('untracked', 'to_read', 'read')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 40),
  normalized_name TEXT NOT NULL UNIQUE CHECK(length(normalized_name) BETWEEN 1 AND 40)
) STRICT;

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
) STRICT;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_bookmarks_url_key
  ON bookmarks(url_key);

CREATE INDEX IF NOT EXISTS idx_bookmarks_reading_created
  ON bookmarks(reading_state, created_at, id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created
  ON bookmarks(created_at, id);

CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_bookmark
  ON bookmark_tags(tag_id, bookmark_id);
