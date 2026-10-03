-- T005: SQLite schema for the Bookmark Manager (see data-model.md).
-- Applied idempotently on startup.

CREATE TABLE IF NOT EXISTS bookmarks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  icon_url      TEXT NOT NULL DEFAULT '',
  preview_image TEXT NOT NULL DEFAULT '',
  is_read       INTEGER NOT NULL DEFAULT 0,
  is_archived   INTEGER NOT NULL DEFAULT 0,
  date_added    TEXT NOT NULL,
  date_modified TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS saved_copies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('html_snapshot', 'pdf', 'internet_archive')),
  location    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  query_text    TEXT NOT NULL DEFAULT '',
  included_tags TEXT NOT NULL DEFAULT '[]',
  excluded_tags TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort TEXT NOT NULL DEFAULT 'date_added_desc',
  page_size    INTEGER NOT NULL DEFAULT 25,
  text_size    TEXT NOT NULL DEFAULT 'medium'
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_archived_added
  ON bookmarks (is_archived, date_added);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags (tag_id);
