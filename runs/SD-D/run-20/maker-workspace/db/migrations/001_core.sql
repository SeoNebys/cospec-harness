CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 2048),
  normalized_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  description TEXT CHECK(description IS NULL OR length(description) <= 500),
  note_document TEXT,
  note_text TEXT NOT NULL DEFAULT '' CHECK(length(note_text) <= 5000),
  lifecycle_state TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle_state IN ('active','archived')),
  reading_state TEXT NOT NULL DEFAULT 'none' CHECK(reading_state IN ('none','unread','read')),
  metadata_status TEXT NOT NULL DEFAULT 'fallback' CHECK(metadata_status IN ('complete','partial','failed','skipped','fallback')),
  icon_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  preview_asset_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 30),
  normalized_label TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX bookmarks_lifecycle_created ON bookmarks(lifecycle_state, created_at DESC, id DESC);
CREATE INDEX bookmarks_lifecycle_reading_created ON bookmarks(lifecycle_state, reading_state, created_at DESC, id DESC);
CREATE INDEX bookmarks_lifecycle_title ON bookmarks(lifecycle_state, title COLLATE NOCASE, id);
CREATE INDEX bookmark_tags_tag ON bookmark_tags(tag_id, bookmark_id);
