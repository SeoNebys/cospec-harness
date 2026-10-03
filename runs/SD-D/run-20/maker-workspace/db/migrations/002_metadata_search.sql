CREATE TABLE media_assets (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('image/png','image/jpeg','image/webp','image/gif','image/avif','image/x-icon','image/vnd.microsoft.icon')),
  byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 2097152),
  relative_path TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK(state IN ('temporary','claimed')),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(content_hash, media_type),
  CHECK((state = 'temporary' AND expires_at IS NOT NULL) OR state = 'claimed')
);

CREATE TABLE metadata_previews (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  requested_url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  final_response_url TEXT,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  description TEXT CHECK(description IS NULL OR length(description) <= 500),
  icon_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  preview_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK(status IN ('complete','partial','failed','skipped','fallback')),
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(warnings_json)),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX metadata_previews_expiry ON metadata_previews(expires_at);
CREATE INDEX media_assets_expiry ON media_assets(state, expires_at);

CREATE VIRTUAL TABLE bookmark_search USING fts5(
  title, url, description, note_text, tags_text,
  tokenize = 'unicode61 remove_diacritics 2'
);
