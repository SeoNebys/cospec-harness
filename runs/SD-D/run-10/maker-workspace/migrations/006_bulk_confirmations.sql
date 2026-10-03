CREATE TABLE IF NOT EXISTS bulk_confirmations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK(action IN ('archive', 'restore', 'delete')),
  selection_json TEXT NOT NULL,
  criteria_digest TEXT NOT NULL,
  expected_count INTEGER NOT NULL CHECK(expected_count >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE INDEX IF NOT EXISTS bulk_confirmations_expiry_idx ON bulk_confirmations(expires_at);
