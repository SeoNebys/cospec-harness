CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  url TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 2048),
  normalized_url TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  normalized_name TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
) STRICT;

CREATE INDEX idx_bookmarks_archive_created
  ON bookmarks (is_archived, created_at, id);
CREATE INDEX idx_bookmarks_archive_favorite_updated
  ON bookmarks (is_archived, is_favorite, updated_at, id);
CREATE INDEX idx_bookmark_tags_tag
  ON bookmark_tags (tag_id, bookmark_id);
