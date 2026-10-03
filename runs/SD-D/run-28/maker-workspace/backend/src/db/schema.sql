-- Bookmark Manager schema (SQLite). See specs/001-bookmark-manager/data-model.md.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bookmark (
  id                   TEXT PRIMARY KEY,
  url                  TEXT NOT NULL,
  url_key              TEXT NOT NULL UNIQUE,
  title_captured       TEXT,
  title_user           TEXT,
  description_captured TEXT,
  description_user     TEXT,
  note_md              TEXT,
  favicon_path         TEXT,
  preview_image_path   TEXT,
  is_unread            INTEGER NOT NULL DEFAULT 0,
  is_archived          INTEGER NOT NULL DEFAULT 0,
  snapshot_path        TEXT,
  snapshot_kind        TEXT,
  archive_org_url      TEXT,
  capture_status       TEXT NOT NULL DEFAULT '{}',
  date_added           TEXT NOT NULL,
  date_modified        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookmark_tag (
  bookmark_id TEXT    NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_view (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  query        TEXT NOT NULL DEFAULT '',
  include_tags TEXT NOT NULL DEFAULT '[]',
  exclude_tags TEXT NOT NULL DEFAULT '[]',
  date_created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort TEXT NOT NULL DEFAULT 'date_added_desc',
  items_shown  INTEGER NOT NULL DEFAULT 25,
  text_size    TEXT NOT NULL DEFAULT 'medium'
);

-- Full-text index over the EFFECTIVE (display) title/description plus url + note.
-- Kept in sync from application code (see db.ts syncFts), keyed by bookmark.rowid,
-- because the indexed title/description are computed (user override else captured).
CREATE VIRTUAL TABLE IF NOT EXISTS bookmark_fts
  USING fts5(title, url, description, note);

CREATE INDEX IF NOT EXISTS idx_bookmark_archived ON bookmark(is_archived);
CREATE INDEX IF NOT EXISTS idx_bookmark_unread ON bookmark(is_unread);
CREATE INDEX IF NOT EXISTS idx_bookmark_date_added ON bookmark(date_added);
CREATE INDEX IF NOT EXISTS idx_bookmark_tag_tag ON bookmark_tag(tag_id);
