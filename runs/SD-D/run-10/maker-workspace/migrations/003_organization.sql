CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  name_normalized TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  UNIQUE(user_id, name_normalized)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 64 AND substr(name, 1, 1) <> '#'),
  name_normalized TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  UNIQUE(user_id, name_normalized)
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS bookmark_tags_tag_idx ON bookmark_tags(tag_id, bookmark_id);
CREATE INDEX IF NOT EXISTS bookmarks_owner_collection_idx ON bookmarks(user_id, collection_id, archived_at);

CREATE TRIGGER IF NOT EXISTS bookmark_collection_owner_insert
BEFORE INSERT ON bookmarks WHEN NEW.collection_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM collections WHERE id = NEW.collection_id AND user_id = NEW.user_id
  ) THEN RAISE(ABORT, 'collection_owner_mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS bookmark_collection_owner_update
BEFORE UPDATE OF collection_id ON bookmarks WHEN NEW.collection_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM collections WHERE id = NEW.collection_id AND user_id = NEW.user_id
  ) THEN RAISE(ABORT, 'collection_owner_mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS bookmark_tag_owner_insert
BEFORE INSERT ON bookmark_tags
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM bookmarks b JOIN tags t ON t.id = NEW.tag_id
    WHERE b.id = NEW.bookmark_id AND b.user_id = t.user_id
  ) THEN RAISE(ABORT, 'tag_owner_mismatch') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM bookmark_tags WHERE bookmark_id = NEW.bookmark_id) >= 50
    THEN RAISE(ABORT, 'tag_limit_exceeded') END;
END;
