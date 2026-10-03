CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  name_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, name_key),
  UNIQUE(id, user_id)
);
CREATE INDEX IF NOT EXISTS folders_owner_name_idx ON folders(user_id, name_key);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  name_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, name_key),
  UNIQUE(id, user_id)
);
CREATE INDEX IF NOT EXISTS tags_owner_name_idx ON tags(user_id, name_key);
CREATE TABLE bookmarks_with_folder_owner (
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
  UNIQUE(id, user_id),
  FOREIGN KEY(folder_id, user_id) REFERENCES folders(id, user_id)
);
INSERT INTO bookmarks_with_folder_owner SELECT * FROM bookmarks;
DROP TABLE bookmarks;
ALTER TABLE bookmarks_with_folder_owner RENAME TO bookmarks;
CREATE INDEX bookmarks_owner_newest_idx ON bookmarks(user_id, created_at DESC, id DESC);
CREATE INDEX bookmarks_owner_oldest_idx ON bookmarks(user_id, created_at ASC, id ASC);
CREATE INDEX bookmarks_owner_title_idx ON bookmarks(user_id, title_sort, id);
CREATE INDEX bookmarks_owner_duplicate_idx ON bookmarks(user_id, normalized_url);
CREATE INDEX bookmarks_owner_folder_idx ON bookmarks(user_id, folder_id, id);
CREATE INDEX bookmarks_owner_favorite_idx ON bookmarks(user_id, is_favorite, id);
CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY(bookmark_id, tag_id),
  FOREIGN KEY(bookmark_id, user_id) REFERENCES bookmarks(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id, user_id) REFERENCES tags(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS bookmark_tags_owner_tag_idx ON bookmark_tags(user_id, tag_id, bookmark_id);
CREATE VIRTUAL TABLE IF NOT EXISTS bookmark_search USING fts5(
  bookmark_id UNINDEXED,
  user_id UNINDEXED,
  title,
  url,
  tags,
  tokenize='trigram'
);
