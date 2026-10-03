PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  library_revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  name_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, name_key)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  name_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, name_key)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description TEXT CHECK(description IS NULL OR length(description) <= 2000),
  notes_markdown TEXT CHECK(notes_markdown IS NULL OR length(notes_markdown) <= 20000),
  notes_search_text TEXT NOT NULL DEFAULT '',
  site_icon_url TEXT,
  preview_image_url TEXT,
  metadata_status TEXT NOT NULL DEFAULT 'unavailable' CHECK(metadata_status IN ('complete','partial','unavailable','blocked','timeout')),
  metadata_warnings_json TEXT NOT NULL DEFAULT '[]',
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  read_state TEXT NOT NULL DEFAULT 'unread' CHECK(read_state IN ('unread','read')),
  archived_at TEXT,
  title_sort_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, normalized_url)
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_views (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  name_key TEXT NOT NULL,
  raw_query TEXT NOT NULL DEFAULT '' CHECK(length(raw_query) <= 1000),
  search_ast_json TEXT NOT NULL DEFAULT '{}',
  filters_json TEXT NOT NULL DEFAULT '{}',
  location TEXT NOT NULL CHECK(location IN ('active','unread','archive')),
  sort TEXT NOT NULL CHECK(sort IN ('newest','oldest','title')),
  parser_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, name_key)
);

CREATE TABLE IF NOT EXISTS media_cache (
  cache_key TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('icon','preview')),
  relative_path TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  fetched_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bookmarks_location_newest ON bookmarks(user_id, archived_at, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookmarks_title ON bookmarks(user_id, archived_at, title_sort_key, id);
CREATE INDEX IF NOT EXISTS bookmarks_unread ON bookmarks(user_id, read_state, archived_at, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookmarks_collection ON bookmarks(user_id, collection_id, archived_at);
CREATE INDEX IF NOT EXISTS bookmark_tags_reverse ON bookmark_tags(tag_id, bookmark_id);

CREATE VIRTUAL TABLE IF NOT EXISTS bookmark_fts USING fts5(
  title, normalized_url, description, notes_search_text,
  content='bookmarks', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO bookmark_fts(rowid,title,normalized_url,description,notes_search_text)
  VALUES(new.id,new.title,new.normalized_url,coalesce(new.description,''),new.notes_search_text);
END;
CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
  INSERT INTO bookmark_fts(bookmark_fts,rowid,title,normalized_url,description,notes_search_text)
  VALUES('delete',old.id,old.title,old.normalized_url,coalesce(old.description,''),old.notes_search_text);
END;
CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
  INSERT INTO bookmark_fts(bookmark_fts,rowid,title,normalized_url,description,notes_search_text)
  VALUES('delete',old.id,old.title,old.normalized_url,coalesce(old.description,''),old.notes_search_text);
  INSERT INTO bookmark_fts(rowid,title,normalized_url,description,notes_search_text)
  VALUES(new.id,new.title,new.normalized_url,coalesce(new.description,''),new.notes_search_text);
END;
