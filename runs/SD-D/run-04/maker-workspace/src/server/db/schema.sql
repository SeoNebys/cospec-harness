-- Bookmark Manager schema (data-model.md).
-- Single-user, local SQLite database.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bookmarks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT NOT NULL,
  url_key       TEXT NOT NULL UNIQUE,          -- normalized duplicate key (FR-023, SC-007)
  title         TEXT NOT NULL,                 -- never empty at rest (FR-004)
  description   TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  icon_url      TEXT,
  image_url     TEXT,
  read_later    INTEGER NOT NULL DEFAULT 0,    -- FR-015
  archived      INTEGER NOT NULL DEFAULT 0,    -- FR-016
  enrich_status TEXT NOT NULL DEFAULT 'pending', -- pending | done | failed
  created_at    TEXT NOT NULL,                 -- ISO; saved date (FR-025), default sort (FR-014)
  updated_at    TEXT NOT NULL                  -- ISO; last-modified (FR-025)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks (created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks (archived);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE                    -- stored lowercased (FR-012)
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks (id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  query_text TEXT NOT NULL DEFAULT '',
  filter     TEXT NOT NULL DEFAULT '{}',       -- serialized TagFilter
  created_at TEXT NOT NULL
);

-- Full-text index over the searchable fields (FR-009/FR-010). A standard FTS5
-- table (not contentless) so rows can be replaced by rowid on update/delete. Kept
-- in sync by the application layer (queries.ts) using the bookmark id as rowid, so
-- a bookmark's fields and its concatenated tag names stay searchable together.
CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
  title, url, description, notes, tags
);
