-- Bookmark Manager schema (see specs/001-bookmark-manager/data-model.md)

CREATE TABLE IF NOT EXISTS bookmark (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  url               TEXT NOT NULL,
  canonical_key     TEXT NOT NULL UNIQUE,
  title             TEXT,
  description       TEXT,
  icon_url          TEXT,
  preview_image_url TEXT,
  note_html         TEXT,
  is_unread         INTEGER NOT NULL DEFAULT 0,
  is_archived       INTEGER NOT NULL DEFAULT 0,
  preserved_path    TEXT,
  preserved_kind    TEXT,          -- 'html' | 'pdf' | NULL
  archive_org_url   TEXT,
  date_added        TEXT NOT NULL, -- ISO 8601
  updated_at        TEXT
);

CREATE TABLE IF NOT EXISTS tag (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS bookmark_tag (
  bookmark_id INTEGER NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_search (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  query         TEXT,
  included_tags TEXT,  -- JSON array of tag names
  excluded_tags TEXT,  -- JSON array of tag names
  created_at    TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort   TEXT NOT NULL DEFAULT 'date_added_desc',
  items_per_view INTEGER NOT NULL DEFAULT 25,
  text_size      TEXT NOT NULL DEFAULT 'medium'
);

CREATE INDEX IF NOT EXISTS idx_bookmark_archived ON bookmark(is_archived);
CREATE INDEX IF NOT EXISTS idx_bookmark_unread ON bookmark(is_unread);
CREATE INDEX IF NOT EXISTS idx_bookmark_date ON bookmark(date_added);
