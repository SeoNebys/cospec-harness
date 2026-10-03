CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  url_key TEXT NOT NULL COLLATE BINARY UNIQUE,
  title TEXT CHECK(title IS NULL OR length(title) <= 1200),
  description TEXT CHECK(description IS NULL OR length(description) <= 8000),
  note_markdown TEXT NOT NULL DEFAULT '' CHECK(length(note_markdown) <= 200000),
  icon_asset_id TEXT REFERENCES icon_assets(hash) ON DELETE SET NULL,
  icon_choice TEXT NOT NULL DEFAULT 'automatic' CHECK(icon_choice IN ('automatic','removed','imported')),
  title_origin TEXT NOT NULL DEFAULT 'fallback' CHECK(title_origin IN ('metadata','user','import','fallback')),
  description_origin TEXT NOT NULL DEFAULT 'none' CHECK(description_origin IN ('metadata','user','import','none')),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
  archived_at TEXT,
  metadata_status TEXT NOT NULL DEFAULT 'idle' CHECK(metadata_status IN ('idle','pending','complete','partial','failed','blocked')),
  metadata_fetched_at TEXT,
  metadata_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  search_title TEXT NOT NULL,
  search_url TEXT NOT NULL,
  search_description TEXT NOT NULL,
  search_note TEXT NOT NULL
) STRICT;
CREATE INDEX bookmarks_recent_idx ON bookmarks(archived_at, updated_at DESC, id);
CREATE INDEX bookmarks_unread_idx ON bookmarks(archived_at, is_read, updated_at DESC, id);
CREATE INDEX bookmarks_title_idx ON bookmarks(archived_at, search_title, id);
