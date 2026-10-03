CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 2048),
  normalized_url TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 10000),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (
    (status = 'active' AND archived_at IS NULL) OR
    (status = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 40),
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX bookmarks_status_created_idx ON bookmarks(status, created_at);
CREATE INDEX bookmarks_status_updated_idx ON bookmarks(status, updated_at);
CREATE INDEX bookmarks_status_title_idx ON bookmarks(status, title COLLATE NOCASE);
CREATE INDEX bookmarks_status_favorite_idx ON bookmarks(status, is_favorite);
CREATE INDEX bookmarks_normalized_url_idx ON bookmarks(normalized_url);
CREATE INDEX tags_name_idx ON tags(name COLLATE NOCASE);
CREATE INDEX bookmark_tags_tag_idx ON bookmark_tags(tag_id, bookmark_id);
