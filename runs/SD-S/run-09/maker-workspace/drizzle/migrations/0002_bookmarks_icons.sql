CREATE TABLE IF NOT EXISTS icon_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha256 TEXT NOT NULL UNIQUE CHECK(length(sha256) = 64 AND sha256 = lower(sha256)),
  media_type TEXT NOT NULL CHECK(media_type IN ('image/png','image/jpeg','image/gif','image/webp','image/x-icon')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 262144),
  bytes BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  final_metadata_url TEXT,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
  title_sort TEXT NOT NULL,
  title_source TEXT NOT NULL CHECK(title_source IN ('page','fallback','user')),
  notes TEXT CHECK(notes IS NULL OR length(notes) <= 10000),
  folder_id INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1)),
  icon_asset_id INTEGER REFERENCES icon_assets(id) ON DELETE SET NULL,
  metadata_status TEXT NOT NULL CHECK(metadata_status IN ('pending','ready','partial','blocked','failed')),
  metadata_failure_code TEXT,
  metadata_fetched_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(id, user_id)
);
CREATE INDEX IF NOT EXISTS bookmarks_owner_newest_idx ON bookmarks(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookmarks_owner_oldest_idx ON bookmarks(user_id, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS bookmarks_owner_title_idx ON bookmarks(user_id, title_sort, id);
CREATE INDEX IF NOT EXISTS bookmarks_owner_duplicate_idx ON bookmarks(user_id, normalized_url);
CREATE INDEX IF NOT EXISTS bookmarks_owner_folder_idx ON bookmarks(user_id, folder_id, id);
CREATE INDEX IF NOT EXISTS bookmarks_owner_favorite_idx ON bookmarks(user_id, is_favorite, id);
