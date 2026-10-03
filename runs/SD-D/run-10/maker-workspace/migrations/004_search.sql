CREATE VIRTUAL TABLE IF NOT EXISTS bookmark_search USING fts5(
  title,
  url,
  description,
  note,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT OR REPLACE INTO bookmark_search(rowid, title, url, description, note, tags)
SELECT b.id, b.title, b.url, COALESCE(b.description, ''), COALESCE(b.note_plain, ''),
       COALESCE((SELECT group_concat(t.name, ' ') FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id), '')
FROM bookmarks b;
