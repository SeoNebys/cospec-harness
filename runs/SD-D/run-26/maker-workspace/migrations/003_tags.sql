CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 400),
  normalized_name TEXT NOT NULL UNIQUE CHECK(length(normalized_name)>0),
  created_at TEXT NOT NULL
) STRICT;
CREATE TABLE bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(bookmark_id, tag_id)
) STRICT;
CREATE INDEX bookmark_tags_tag_idx ON bookmark_tags(tag_id, bookmark_id);
