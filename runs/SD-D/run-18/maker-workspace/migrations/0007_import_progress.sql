ALTER TABLE bookmarks ADD COLUMN import_id TEXT REFERENCES import_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_import ON bookmarks(import_id, copy_status);
