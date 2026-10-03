-- Bookmark Manager schema (SQLite)

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  url_key TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  note TEXT,
  icon_url TEXT,
  preview_image_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  read_later INTEGER NOT NULL DEFAULT 0 CHECK (read_later IN (0,1)),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
  metadata_status TEXT NOT NULL DEFAULT 'ok' CHECK (metadata_status IN ('ok','partial','failed'))
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_url_key ON bookmarks(url_key);
CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(is_archived);
CREATE INDEX IF NOT EXISTS idx_bookmarks_read_later ON bookmarks(read_later);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
-- Tag names unique within the collection, case-insensitive (FR-010a)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_lower ON tags(lower(name));

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);

CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  query TEXT,
  include_tags TEXT NOT NULL DEFAULT '[]',
  exclude_tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS preserved_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('html','pdf')),
  file_path TEXT,
  created_at INTEGER NOT NULL,
  archive_org_url TEXT,
  archive_org_status TEXT CHECK (archive_org_status IN ('ok','pending','failed'))
);
CREATE INDEX IF NOT EXISTS idx_preserved_bookmark ON preserved_copies(bookmark_id);

CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_sort TEXT NOT NULL DEFAULT 'date_added' CHECK (default_sort IN ('date_added','title','last_updated')),
  items_per_page INTEGER NOT NULL DEFAULT 25,
  text_size TEXT NOT NULL DEFAULT 'medium' CHECK (text_size IN ('small','medium','large'))
);

-- Full-text search over text fields (case-insensitive by default)
CREATE VIRTUAL TABLE IF NOT EXISTS bookmark_fts USING fts5(
  title, description, note, url,
  content='bookmarks', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO bookmark_fts(rowid, title, description, note, url)
  VALUES (new.id, new.title, new.description, new.note, new.url);
END;
CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
  INSERT INTO bookmark_fts(bookmark_fts, rowid, title, description, note, url)
  VALUES ('delete', old.id, old.title, old.description, old.note, old.url);
END;
CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
  INSERT INTO bookmark_fts(bookmark_fts, rowid, title, description, note, url)
  VALUES ('delete', old.id, old.title, old.description, old.note, old.url);
  INSERT INTO bookmark_fts(rowid, title, description, note, url)
  VALUES (new.id, new.title, new.description, new.note, new.url);
END;
