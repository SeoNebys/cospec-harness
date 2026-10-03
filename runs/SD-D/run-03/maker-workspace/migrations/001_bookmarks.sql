CREATE TABLE bookmark_icons (
  content_hash TEXT PRIMARY KEY,
  png_bytes BLOB NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0 AND width <= 512),
  height INTEGER NOT NULL CHECK (height > 0 AND height <= 512),
  byte_length INTEGER NOT NULL CHECK (byte_length > 0 AND byte_length <= 262144),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL UNIQUE,
  address_revision INTEGER NOT NULL DEFAULT 1 CHECK (address_revision >= 1),
  title TEXT NOT NULL,
  title_sort_key TEXT NOT NULL,
  title_provenance TEXT NOT NULL CHECK (title_provenance IN ('fallback', 'retrieved', 'user')),
  retrieved_title_candidate TEXT,
  description TEXT NOT NULL DEFAULT '',
  description_provenance TEXT NOT NULL CHECK (description_provenance IN ('fallback', 'retrieved', 'user')),
  retrieved_description_candidate TEXT,
  icon_hash TEXT REFERENCES bookmark_icons(content_hash) ON UPDATE CASCADE ON DELETE SET NULL,
  metadata_status TEXT NOT NULL CHECK (metadata_status IN ('pending', 'complete', 'partial', 'failed', 'skipped_unsafe')),
  metadata_error_code TEXT,
  metadata_fetched_at TEXT,
  note_markdown TEXT NOT NULL DEFAULT '',
  note_plain TEXT NOT NULL DEFAULT '',
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  is_unread INTEGER NOT NULL DEFAULT 0 CHECK (is_unread IN (0, 1)),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX bookmarks_archive_created_idx ON bookmarks(archived_at, created_at, id);
CREATE INDEX bookmarks_archive_updated_idx ON bookmarks(archived_at, updated_at, id);
CREATE INDEX bookmarks_archive_title_idx ON bookmarks(archived_at, title_sort_key, id);
CREATE INDEX bookmarks_archive_unread_idx ON bookmarks(archived_at, is_unread, created_at, id);
CREATE INDEX bookmarks_archive_favorite_idx ON bookmarks(archived_at, is_favorite, created_at, id);
CREATE INDEX bookmarks_icon_hash_idx ON bookmarks(icon_hash);
