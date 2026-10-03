-- Creating this table is also the startup capability check for both FTS5 and
-- its trigram tokenizer. SQLite aborts this transactional migration before the
-- application becomes ready if either capability is unavailable.
CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  name_key TEXT NOT NULL UNIQUE CHECK (length(name_key) > 0),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX bookmark_tags_tag_bookmark_idx ON bookmark_tags(tag_id, bookmark_id);

CREATE VIRTUAL TABLE bookmark_search USING fts5(
  title,
  address,
  description,
  note_plain,
  tokenize = 'trigram'
);

-- Backfill bookmarks created before this migration. Application writes replace
-- these values with NFKC/case-normalized content through SearchRepository.
INSERT INTO bookmark_search(rowid, title, address, description, note_plain)
SELECT id, title, address, description, note_plain FROM bookmarks;

-- Triggers preserve transactional row membership for every write path. The
-- repository performs the stronger Unicode normalization when it owns a write.
CREATE TRIGGER bookmark_search_after_insert
AFTER INSERT ON bookmarks
BEGIN
  INSERT INTO bookmark_search(rowid, title, address, description, note_plain)
  VALUES (new.id, new.title, new.address, new.description, new.note_plain);
END;

CREATE TRIGGER bookmark_search_after_update
AFTER UPDATE OF title, address, description, note_plain ON bookmarks
BEGIN
  DELETE FROM bookmark_search WHERE rowid = old.id;
  INSERT INTO bookmark_search(rowid, title, address, description, note_plain)
  VALUES (new.id, new.title, new.address, new.description, new.note_plain);
END;

CREATE TRIGGER bookmark_search_after_delete
AFTER DELETE ON bookmarks
BEGIN
  DELETE FROM bookmark_search WHERE rowid = old.id;
END;
