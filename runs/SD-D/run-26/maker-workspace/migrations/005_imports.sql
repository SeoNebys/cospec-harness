CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('generic_browser_html','bookmark_manager_export')),
  source_version INTEGER,
  status TEXT NOT NULL CHECK(status IN ('previewed','committing','committed','cancelled','expired')),
  new_count INTEGER NOT NULL CHECK(new_count>=0),
  duplicate_count INTEGER NOT NULL CHECK(duplicate_count>=0),
  invalid_count INTEGER NOT NULL CHECK(invalid_count>=0),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  committed_at TEXT
) STRICT;
CREATE TABLE import_entries (
  id INTEGER PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  classification TEXT NOT NULL CHECK(classification IN ('new','duplicate','invalid')),
  reason_code TEXT,
  duplicate_bookmark_id TEXT,
  url TEXT,
  url_key TEXT,
  title TEXT,
  description TEXT,
  note_markdown TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
  archived_at TEXT,
  icon_bytes BLOB,
  icon_mime TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(batch_id, ordinal)
) STRICT;
