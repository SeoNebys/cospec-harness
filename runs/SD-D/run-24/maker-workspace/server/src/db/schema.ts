// SQLite schema. Search uses case-insensitive LIKE over the text columns
// (substring + exact-phrase semantics per spec FR-010/FR-011); no FTS table is
// required. Tag membership is evaluated via the bookmark_tags join.
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bookmarks (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  url                TEXT NOT NULL,
  normalized_url     TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  icon_path          TEXT,
  preview_image_path TEXT,
  note_markdown      TEXT NOT NULL DEFAULT '',
  read               INTEGER NOT NULL DEFAULT 1,
  archived           INTEGER NOT NULL DEFAULT 0,
  saved_at           TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL UNIQUE,
  search_expression TEXT NOT NULL DEFAULT '',
  included_tag_ids  TEXT NOT NULL DEFAULT '[]',
  excluded_tag_ids  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS preserved_copies (
  bookmark_id INTEGER PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  type        TEXT,
  file_path   TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  byte_size   INTEGER,
  wayback_url TEXT,
  captured_at TEXT
);

CREATE TABLE IF NOT EXISTS display_preferences (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort TEXT NOT NULL DEFAULT 'saved_desc',
  page_size    INTEGER NOT NULL DEFAULT 50,
  text_size    TEXT NOT NULL DEFAULT 'medium'
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(archived);
CREATE INDEX IF NOT EXISTS idx_bookmarks_read ON bookmarks(read);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);
`;
