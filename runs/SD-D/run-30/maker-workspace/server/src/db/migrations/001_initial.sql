CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE bookmarks(
 id TEXT PRIMARY KEY, url TEXT NOT NULL CHECK(length(url)<=4096), normalized_url TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200), note_source TEXT NOT NULL DEFAULT '' CHECK(length(note_source)<=2000), note_search_text TEXT NOT NULL DEFAULT '',
 is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN(0,1)), is_read_later INTEGER NOT NULL DEFAULT 0 CHECK(is_read_later IN(0,1)),
 is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN(0,1)), is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN(0,1)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE tags(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 40), normalized_name TEXT NOT NULL UNIQUE);
CREATE TABLE bookmark_tags(bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(bookmark_id,tag_id));
CREATE TABLE media_assets(id TEXT PRIMARY KEY, bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN('icon','preview')), content_type TEXT NOT NULL CHECK(content_type IN('image/png','image/jpeg','image/webp','image/gif')), bytes BLOB NOT NULL CHECK(length(bytes)<=2097152), source_url TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(bookmark_id,kind));
CREATE INDEX idx_bookmarks_state ON bookmarks(is_archived,is_favorite,is_read_later,is_read,created_at);
CREATE INDEX idx_bookmarks_title ON bookmarks(title COLLATE NOCASE);
CREATE INDEX idx_bookmark_tags_tag ON bookmark_tags(tag_id,bookmark_id);
