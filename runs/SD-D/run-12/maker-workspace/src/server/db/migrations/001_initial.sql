CREATE TABLE IF NOT EXISTS icon_assets (
  id INTEGER PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png','image/jpeg','image/gif','image/webp','image/x-icon','image/vnd.microsoft.icon')),
  bytes BLOB NOT NULL CHECK (length(bytes) <= 262144),
  content_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 512),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 10000),
  icon_asset_id INTEGER REFERENCES icon_assets(id) ON DELETE SET NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0,1)),
  is_unread INTEGER NOT NULL DEFAULT 0 CHECK (is_unread IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  url_search TEXT NOT NULL,
  title_search TEXT NOT NULL,
  description_search TEXT NOT NULL DEFAULT '',
  notes_search TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 64),
  normalized_name TEXT NOT NULL UNIQUE,
  search_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS bookmark_tags_by_tag ON bookmark_tags(tag_id, bookmark_id);
CREATE INDEX IF NOT EXISTS bookmarks_by_icon ON bookmarks(icon_asset_id);
CREATE INDEX IF NOT EXISTS bookmarks_recent ON bookmarks(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookmarks_favorite_recent ON bookmarks(is_favorite, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookmarks_unread_recent ON bookmarks(is_unread, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookmarks_favorite_unread_recent ON bookmarks(is_favorite, is_unread, created_at DESC, id DESC);
