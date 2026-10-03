CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('favicon', 'preview')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'attached')),
  storage_key TEXT NOT NULL UNIQUE,
  source_url TEXT,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS media_assets_owner_status_idx ON media_assets(user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 4096),
  url_normalized TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  note_markdown TEXT CHECK (note_markdown IS NULL OR length(note_markdown) <= 100000),
  note_plain TEXT,
  favicon_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  preview_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  collection_id INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  reading_state TEXT NOT NULL DEFAULT 'none' CHECK (reading_state IN ('none', 'unread', 'read')),
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (user_id, url_normalized)
);

CREATE INDEX IF NOT EXISTS bookmarks_owner_active_created_idx ON bookmarks(user_id, archived_at, created_at DESC);
CREATE INDEX IF NOT EXISTS bookmarks_owner_reading_idx ON bookmarks(user_id, archived_at, reading_state);
CREATE INDEX IF NOT EXISTS bookmarks_owner_favorite_idx ON bookmarks(user_id, archived_at, is_favorite);
