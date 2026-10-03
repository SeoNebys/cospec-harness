CREATE TABLE metadata_jobs (
  id TEXT PRIMARY KEY,
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind='import_missing'),
  status TEXT NOT NULL CHECK(status IN ('queued','running','complete','partial','failed','blocked')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 1),
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
) STRICT;
CREATE UNIQUE INDEX metadata_jobs_active_idx ON metadata_jobs(bookmark_id,kind) WHERE status IN ('queued','running');
