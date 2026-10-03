CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL CHECK(length(url) <= 2048),
  normalized_url TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description TEXT CHECK(description IS NULL OR length(description) <= 500),
  notes TEXT CHECK(notes IS NULL OR length(notes) <= 2000),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bookmarks_normalized_url_idx ON bookmarks(normalized_url);
CREATE INDEX IF NOT EXISTS bookmarks_created_at_idx ON bookmarks(created_at);
CREATE INDEX IF NOT EXISTS bookmarks_updated_at_idx ON bookmarks(updated_at);
CREATE INDEX IF NOT EXISTS bookmarks_favorite_idx ON bookmarks(is_favorite);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 40),
  normalized_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS bookmark_tags_tag_idx ON bookmark_tags(tag_id, bookmark_id);
