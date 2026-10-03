CREATE VIRTUAL TABLE bookmark_search USING fts5(
  bookmark_id UNINDEXED,
  user_id UNINDEXED,
  title,
  url,
  description,
  notes,
  tags,
  tokenize='unicode61 remove_diacritics 2'
);
