CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  normalized_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, normalized_name)
);
CREATE INDEX tags_owner_name_idx ON tags(user_id, normalized_name);

CREATE TABLE bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(bookmark_id, tag_id)
);

CREATE VIRTUAL TABLE bookmark_search USING fts5(
  bookmark_id UNINDEXED,
  user_id UNINDEXED,
  title,
  url,
  description,
  notes,
  tags,
  tokenize='unicode61 remove_diacritics 2'
);
