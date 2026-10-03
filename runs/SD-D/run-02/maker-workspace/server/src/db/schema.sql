-- Bookmark Manager schema (data-model.md)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bookmark (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  url                   TEXT NOT NULL,
  url_key               TEXT NOT NULL UNIQUE,
  title                 TEXT,
  title_user_set        INTEGER NOT NULL DEFAULT 0,
  description           TEXT,
  description_user_set  INTEGER NOT NULL DEFAULT 0,
  favicon_path          TEXT,
  favicon_url           TEXT,
  preview_path          TEXT,
  preview_url           TEXT,
  note_md               TEXT,
  read_state            TEXT NOT NULL DEFAULT 'unread' CHECK (read_state IN ('unread','read')),
  archived              INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  metadata_status       TEXT NOT NULL DEFAULT 'pending' CHECK (metadata_status IN ('pending','complete','failed')),
  internet_archive_url  TEXT,
  date_added            TEXT NOT NULL,
  date_updated          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmark_archived   ON bookmark(archived);
CREATE INDEX IF NOT EXISTS idx_bookmark_read_state ON bookmark(read_state);
CREATE INDEX IF NOT EXISTS idx_bookmark_date_added ON bookmark(date_added);
CREATE INDEX IF NOT EXISTS idx_bookmark_title      ON bookmark(title);

CREATE TABLE IF NOT EXISTS tag (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  name_key  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookmark_tag (
  bookmark_id INTEGER NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_tag_tag ON bookmark_tag(tag_id);

CREATE TABLE IF NOT EXISTS saved_search (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  query_text    TEXT,
  include_tags  TEXT NOT NULL DEFAULT '[]',
  exclude_tags  TEXT NOT NULL DEFAULT '[]',
  view_scope    TEXT NOT NULL DEFAULT 'normal' CHECK (view_scope IN ('normal','unread','archived')),
  sort          TEXT NOT NULL DEFAULT 'date_added_desc',
  date_created  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshot (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id   INTEGER NOT NULL UNIQUE REFERENCES bookmark(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('html','pdf')),
  file_path     TEXT NOT NULL,
  byte_size     INTEGER,
  date_captured TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort   TEXT NOT NULL DEFAULT 'date_added_desc',
  items_per_page INTEGER NOT NULL DEFAULT 25 CHECK (items_per_page > 0),
  font_size      TEXT NOT NULL DEFAULT 'medium' CHECK (font_size IN ('small','medium','large'))
);

INSERT OR IGNORE INTO preferences (id, default_sort, items_per_page, font_size)
VALUES (1, 'date_added_desc', 25, 'medium');
