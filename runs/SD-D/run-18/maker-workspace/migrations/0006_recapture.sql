ALTER TABLE capture_attempts ADD COLUMN candidate_saved_copy_id TEXT REFERENCES saved_copies(id) ON DELETE SET NULL;
