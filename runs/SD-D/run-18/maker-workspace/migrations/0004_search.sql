CREATE VIRTUAL TABLE IF NOT EXISTS bookmark_fts USING fts5(bookmark_id UNINDEXED,title,url,description,note_text,tags,tokenize='unicode61 remove_diacritics 2');
