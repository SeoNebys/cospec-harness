CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  name_normalized TEXT NOT NULL,
  query_text TEXT NOT NULL DEFAULT '' CHECK(length(query_text) <= 2000),
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  collection_mode TEXT NOT NULL DEFAULT 'any' CHECK(collection_mode IN ('any', 'unfiled', 'id')),
  favorite_filter TEXT NOT NULL DEFAULT 'any' CHECK(favorite_filter IN ('any', 'favorite', 'not_favorite')),
  reading_filter TEXT NOT NULL DEFAULT 'any' CHECK(reading_filter IN ('any', 'none', 'unread', 'read')),
  context TEXT NOT NULL DEFAULT 'active' CHECK(context IN ('active', 'archive')),
  sort TEXT NOT NULL DEFAULT 'newest' CHECK(sort IN ('newest', 'oldest', 'title', 'updated')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  UNIQUE(user_id, name_normalized)
);

CREATE TABLE IF NOT EXISTS saved_search_tags (
  saved_search_id INTEGER NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  polarity TEXT NOT NULL CHECK(polarity IN ('include', 'exclude')),
  PRIMARY KEY(saved_search_id, tag_id)
);
