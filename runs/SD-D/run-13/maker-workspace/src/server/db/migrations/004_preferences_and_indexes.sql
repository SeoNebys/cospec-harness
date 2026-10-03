CREATE TABLE preferences (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  sort_field TEXT NOT NULL DEFAULT 'createdAt' CHECK(sort_field IN ('title','createdAt','updatedAt')),
  sort_direction TEXT NOT NULL DEFAULT 'desc' CHECK(sort_direction IN ('asc','desc')),
  updated_at INTEGER NOT NULL
) STRICT;

INSERT INTO preferences(id, sort_field, sort_direction, updated_at)
VALUES(1, 'createdAt', 'desc', unixepoch('subsec') * 1000);

CREATE INDEX bookmarks_active_created ON bookmarks(archived_at, created_at DESC, id);
CREATE INDEX bookmarks_read_created ON bookmarks(archived_at, to_read, created_at DESC, id);
CREATE INDEX metadata_drafts_expiry ON metadata_drafts(expires_at);
