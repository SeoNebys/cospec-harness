import type { AppDatabase } from '../db/connection.js';

export function replaceSearchRow(db: AppDatabase, bookmarkId: number): void {
  const bookmark = db
    .prepare('SELECT title,url,description,note_text FROM bookmarks WHERE id=?')
    .get(bookmarkId) as
    | { title: string; url: string; description: string | null; note_text: string }
    | undefined;
  db.prepare('DELETE FROM bookmark_search WHERE rowid=?').run(bookmarkId);
  if (!bookmark) return;
  const tags = (
    db
      .prepare(
        `SELECT t.label FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.label COLLATE NOCASE`,
      )
      .all(bookmarkId) as Array<{ label: string }>
  )
    .map((tag) => tag.label)
    .join(' ');
  db.prepare(
    'INSERT INTO bookmark_search(rowid,title,url,description,note_text,tags_text) VALUES (?,?,?,?,?,?)',
  ).run(bookmarkId, bookmark.title, bookmark.url, bookmark.description ?? '', bookmark.note_text, tags);
}

export function rebuildSearchIndex(db: AppDatabase): void {
  db.prepare('DELETE FROM bookmark_search').run();
  const ids = db.prepare('SELECT id FROM bookmarks').all() as Array<{ id: number }>;
  for (const { id } of ids) replaceSearchRow(db, id);
}
