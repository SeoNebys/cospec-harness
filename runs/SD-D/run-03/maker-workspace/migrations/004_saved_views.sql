CREATE TABLE saved_views (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  name_key TEXT NOT NULL UNIQUE CHECK (length(name_key) > 0),
  query_text TEXT NOT NULL,
  grammar_version INTEGER NOT NULL DEFAULT 1 CHECK (grammar_version = 1),
  scope TEXT NOT NULL CHECK (scope IN ('active', 'read_later', 'archived')),
  favorite_filter INTEGER CHECK (favorite_filter IS NULL OR favorite_filter IN (0, 1)),
  unread_filter INTEGER CHECK (unread_filter IS NULL OR unread_filter IN (0, 1)),
  sort_order TEXT NOT NULL CHECK (
    sort_order IN ('created_desc', 'created_asc', 'updated_desc', 'title_asc')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE saved_view_tags (
  saved_view_id INTEGER NOT NULL REFERENCES saved_views(id) ON DELETE CASCADE,
  tag_key TEXT NOT NULL CHECK (length(tag_key) > 0),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  PRIMARY KEY (saved_view_id, tag_key)
) STRICT, WITHOUT ROWID;

CREATE INDEX saved_view_tags_tag_view_idx ON saved_view_tags(tag_key, saved_view_id);
