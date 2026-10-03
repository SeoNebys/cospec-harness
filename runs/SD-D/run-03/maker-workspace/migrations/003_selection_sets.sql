CREATE TABLE selection_sets (
  id TEXT PRIMARY KEY CHECK (length(id) >= 32),
  criteria_hash TEXT NOT NULL CHECK (length(trim(criteria_hash)) > 0),
  selected_count INTEGER NOT NULL CHECK (selected_count > 0),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL CHECK (expires_at > created_at)
) STRICT;

CREATE TABLE selection_items (
  selection_id TEXT NOT NULL REFERENCES selection_sets(id) ON DELETE CASCADE,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  PRIMARY KEY (selection_id, bookmark_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX selection_items_bookmark_idx ON selection_items(bookmark_id);
CREATE INDEX selection_sets_expiry_idx ON selection_sets(expires_at);
