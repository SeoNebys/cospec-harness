CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK(format IN ('browser-html','complete-json')),
  status TEXT NOT NULL CHECK(status IN ('previewed','committing','completed','partial','failed','expired')),
  file_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  total_count INTEGER NOT NULL CHECK(total_count >= 0),
  new_count INTEGER NOT NULL CHECK(new_count >= 0),
  duplicate_count INTEGER NOT NULL CHECK(duplicate_count >= 0),
  invalid_count INTEGER NOT NULL CHECK(invalid_count >= 0),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;
CREATE INDEX import_batches_user_idx ON import_batches(user_id, created_at);

CREATE TABLE import_entries (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  classification TEXT NOT NULL CHECK(classification IN ('new','duplicate','invalid')),
  outcome TEXT NOT NULL CHECK(outcome IN ('pending','imported','skipped_duplicate','failed')),
  detail TEXT NOT NULL DEFAULT '',
  UNIQUE(batch_id, ordinal)
) STRICT;
