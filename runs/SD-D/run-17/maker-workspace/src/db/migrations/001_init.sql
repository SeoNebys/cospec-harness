-- Initial schema (data-model.md)
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  note TEXT,
  icon_url TEXT,
  preview_image_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 1,      -- new bookmarks start read
  is_archived INTEGER NOT NULL DEFAULT 0,
  page_copy_path TEXT,
  page_copy_kind TEXT,                       -- 'html' | 'pdf'
  archive_org_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  terms TEXT,
  include_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array of tag names
  exclude_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array of tag names
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort TEXT NOT NULL DEFAULT 'newest',   -- newest|oldest|title|updated
  page_size INTEGER NOT NULL DEFAULT 25,
  text_size TEXT NOT NULL DEFAULT 'medium'       -- small|medium|large
);
