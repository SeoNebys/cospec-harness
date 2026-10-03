import type Database from "better-sqlite3";

export function reindexBookmark(db: Database.Database, id: string) {
  const row = db.prepare(`SELECT b.id, b.title, b.url_original url, b.description, b.note,
    COALESCE(group_concat(t.display_name, ' '), '') tags
    FROM bookmarks b LEFT JOIN bookmark_tags bt ON bt.bookmark_id=b.id
    LEFT JOIN tags t ON t.id=bt.tag_id WHERE b.id=? GROUP BY b.id`).get(id) as Record<string,string> | undefined;
  db.prepare("DELETE FROM bookmark_search WHERE bookmark_id=?").run(id);
  if (row) db.prepare("INSERT INTO bookmark_search(bookmark_id,title,url,description,note,tags_text) VALUES(?,?,?,?,?,?)")
    .run(row.id,row.title,row.url,row.description,row.note,row.tags);
}

export function rebuildIndex(db: Database.Database) {
  db.prepare("DELETE FROM bookmark_search").run();
  const ids = db.prepare("SELECT id FROM bookmarks").all() as {id:string}[];
  for (const { id } of ids) reindexBookmark(db,id);
}
