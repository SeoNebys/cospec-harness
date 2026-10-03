CREATE TABLE icon_assets (
  id TEXT PRIMARY KEY CHECK(length(id) = 64),
  media_type TEXT NOT NULL CHECK(media_type IN ('image/png','image/jpeg','image/gif','image/webp')),
  content BLOB NOT NULL CHECK(length(content) BETWEEN 1 AND 131072),
  byte_length INTEGER NOT NULL CHECK(byte_length = length(content)),
  created_at TEXT NOT NULL
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 2048),
  normalized_url_hash BLOB NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
  title_source TEXT NOT NULL CHECK(title_source IN ('metadata','fallback','user')),
  description TEXT CHECK(description IS NULL OR length(description) <= 1000),
  notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
  icon_asset_id TEXT REFERENCES icon_assets(id) ON DELETE SET NULL,
  metadata_status TEXT NOT NULL CHECK(metadata_status IN ('complete','partial','failed')),
  metadata_message_code TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  archived_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((status = 'active' AND archived_at IS NULL) OR (status = 'archived' AND archived_at IS NOT NULL))
);

CREATE INDEX bookmarks_owner_list_idx ON bookmarks(user_id, status, created_at DESC, id DESC);
CREATE INDEX bookmarks_owner_hash_idx ON bookmarks(user_id, normalized_url_hash);
CREATE INDEX bookmarks_owner_favorite_idx ON bookmarks(user_id, status, is_favorite, created_at DESC, id DESC);
