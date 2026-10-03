-- Initial schema for Bookmark Manager (see specs/001-bookmark-manager/data-model.md)

CREATE TABLE IF NOT EXISTS bookmark (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  url_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  note_md TEXT,
  favicon_url TEXT,
  preview_image_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  metadata_unavailable INTEGER NOT NULL DEFAULT 0,
  preserved_html_path TEXT,
  preserved_pdf_path TEXT,
  archive_org_url TEXT,
  date_added TEXT NOT NULL,
  date_modified TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_search (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  query_text TEXT,
  include_tags TEXT,
  exclude_tags TEXT,
  date_added TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort TEXT NOT NULL,
  items_per_page INTEGER NOT NULL,
  text_size TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmark_state ON bookmark (is_archived, is_read);
CREATE INDEX IF NOT EXISTS idx_bookmark_date_added ON bookmark (date_added);
CREATE INDEX IF NOT EXISTS idx_bookmark_title ON bookmark (title COLLATE NOCASE);

INSERT OR IGNORE INTO preferences (id, default_sort, items_per_page, text_size)
VALUES (1, 'date_added_desc', 25, 'medium');
