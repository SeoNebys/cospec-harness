DELETE FROM tags
WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE bookmark_tags.tag_id = tags.id)
  AND NOT EXISTS (SELECT 1 FROM saved_views WHERE instr(saved_views.tag_ids, tags.id) > 0);
