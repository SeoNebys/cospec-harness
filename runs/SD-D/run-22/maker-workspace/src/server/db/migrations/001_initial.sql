CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  icon_path TEXT,
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 10000),
  read_later INTEGER NOT NULL DEFAULT 0 CHECK (read_later IN (0, 1)),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (read_later = 1 OR is_read = 0)
) STRICT;

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  normalized_name TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
) STRICT;

CREATE INDEX bookmarks_normalized_url_idx ON bookmarks(normalized_url);
CREATE INDEX bookmarks_created_at_idx ON bookmarks(created_at);
CREATE INDEX bookmarks_normalized_title_idx ON bookmarks(lower(title));
CREATE INDEX bookmarks_reading_state_idx ON bookmarks(read_later, is_read);
CREATE INDEX bookmark_tags_tag_idx ON bookmark_tags(tag_id, bookmark_id);
CREATE INDEX bookmark_tags_bookmark_idx ON bookmark_tags(bookmark_id, tag_id);

CREATE TRIGGER bookmarks_created_at_immutable
BEFORE UPDATE OF created_at ON bookmarks
WHEN NEW.created_at <> OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'created_at is immutable');
END;
