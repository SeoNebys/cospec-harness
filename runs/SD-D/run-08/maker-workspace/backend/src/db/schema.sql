-- Bookmark Manager schema (SQLite). Applied idempotently on boot.

CREATE TABLE IF NOT EXISTS bookmarks (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  url                TEXT NOT NULL,
  url_key            TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  note_md            TEXT,
  favicon_path       TEXT,
  preview_path       TEXT,
  snapshot_path      TEXT,
  snapshot_kind      TEXT,                                   -- 'html' | 'pdf' | NULL
  snapshot_status    TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'ready' | 'failed'
  archive_org_url    TEXT,
  archive_org_status TEXT NOT NULL DEFAULT 'none',           -- 'none' | 'pending' | 'ready' | 'failed'
  is_unread          INTEGER NOT NULL DEFAULT 0,             -- NOT auto-set on create (FR-023)
  is_archived        INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_archived_created
  ON bookmarks (is_archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_archived_title
  ON bookmarks (is_archived, title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_bookmarks_unread
  ON bookmarks (is_unread);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks (id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags (tag_id);

CREATE TABLE IF NOT EXISTS saved_views (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  query        TEXT NOT NULL DEFAULT '',
  include_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array of tag names
  exclude_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array of tag names
  sort         TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort   TEXT NOT NULL DEFAULT 'created_desc',
  items_per_page INTEGER NOT NULL DEFAULT 25,
  font_size      TEXT NOT NULL DEFAULT 'medium'
);

-- Full-text index over the searchable text columns (FR-014). Kept in sync via triggers.
CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5 (
  title,
  description,
  note,
  url,
  content=''
);

CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO bookmarks_fts (rowid, title, description, note, url)
  VALUES (new.id, new.title, new.description, COALESCE(new.note_md, ''), new.url);
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts (bookmarks_fts, rowid, title, description, note, url)
  VALUES ('delete', old.id, old.title, old.description, COALESCE(old.note_md, ''), old.url);
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts (bookmarks_fts, rowid, title, description, note, url)
  VALUES ('delete', old.id, old.title, old.description, COALESCE(old.note_md, ''), old.url);
  INSERT INTO bookmarks_fts (rowid, title, description, note, url)
  VALUES (new.id, new.title, new.description, COALESCE(new.note_md, ''), new.url);
END;
