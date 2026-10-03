CREATE TABLE owner_sessions (
  token_digest BLOB PRIMARY KEY,
  csrf_digest BLOB NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  idle_expires_at TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL
) STRICT;
