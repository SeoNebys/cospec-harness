-- Bookmark Manager schema. All data is one global shared collection (FR-042);
-- nothing is keyed by session.

CREATE TABLE IF NOT EXISTS bookmarks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  url               TEXT NOT NULL,
  url_key           TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  note_html         TEXT NOT NULL DEFAULT '',
  note_text         TEXT NOT NULL DEFAULT '',
  icon_url          TEXT,
  preview_image_url TEXT,
  is_read           INTEGER NOT NULL DEFAULT 0,
  is_archived       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(is_archived);
CREATE INDEX IF NOT EXISTS idx_bookmarks_read ON bookmarks(is_read);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at);

CREATE TABLE IF NOT EXISTS tags (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  name_key  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);

CREATE TABLE IF NOT EXISTS saved_views (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  query         TEXT NOT NULL DEFAULT '',
  included_tags TEXT NOT NULL DEFAULT '[]',
  excluded_tags TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preserved_copies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('html', 'pdf', 'archive_org')),
  location    TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preserved_bookmark ON preserved_copies(bookmark_id);

-- Single global preferences row (id = 1), not session-scoped (FR-042).
CREATE TABLE IF NOT EXISTS preferences (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort   TEXT NOT NULL DEFAULT 'added_desc',
  items_per_page INTEGER NOT NULL DEFAULT 25,
  text_size      TEXT NOT NULL DEFAULT 'medium'
);
