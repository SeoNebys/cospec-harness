CREATE TABLE media_assets (
  id TEXT PRIMARY KEY CHECK(length(id) = 64),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/webp')),
  bytes BLOB NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length = length(bytes) AND byte_length <= 2097152),
  width INTEGER NOT NULL CHECK(width > 0 AND width <= 1200 AND (mime_type <> 'image/png' OR width <= 128)),
  height INTEGER NOT NULL CHECK(height > 0 AND height <= 630 AND (mime_type <> 'image/png' OR height <= 128)),
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE metadata_drafts (
  id TEXT PRIMARY KEY,
  normalized_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  title TEXT CHECK(title IS NULL OR length(title) <= 300),
  description TEXT CHECK(description IS NULL OR length(description) <= 2000),
  icon_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  preview_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
