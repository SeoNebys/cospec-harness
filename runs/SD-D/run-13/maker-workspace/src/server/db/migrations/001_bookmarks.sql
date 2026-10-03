CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 4096),
  normalized_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300),
  description TEXT CHECK(description IS NULL OR length(description) <= 2000),
  notes_json TEXT NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}' CHECK(length(notes_json) <= 102400),
  notes_text TEXT NOT NULL DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
  to_read INTEGER NOT NULL DEFAULT 0 CHECK(to_read IN (0,1)),
  archived_at INTEGER,
  icon_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  preview_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  metadata_refreshed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
