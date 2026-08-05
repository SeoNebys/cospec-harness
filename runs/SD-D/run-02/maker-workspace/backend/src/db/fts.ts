/**
 * FTS5 index maintenance. We use a contentless FTS table keyed by the bookmark id
 * (rowid), so we (re)index explicitly whenever a bookmark or its tags change.
 */
import type Database from 'better-sqlite3';

export function reindexBookmark(db: Database.Database, bookmarkId: number): void {
  const row = db
    .prepare(
      `SELECT b.id, b.title, b.url, b.description, b.notes,
              COALESCE(GROUP_CONCAT(t.name, ' '), '') AS tags
       FROM bookmarks b
       LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
       LEFT JOIN tags t ON t.id = bt.tag_id
       WHERE b.id = ?
       GROUP BY b.id`
    )
    .get(bookmarkId) as
    | { id: number; title: string; url: string; description: string; notes: string; tags: string }
    | undefined;

  db.prepare(`DELETE FROM bookmarks_fts WHERE rowid = ?`).run(bookmarkId);
  if (!row) return;

  // Notes are stored as HTML; index a text-ish version so formatting tags aren't searchable noise.
  const notesText = row.notes.replace(/<[^>]+>/g, ' ');
  db.prepare(
    `INSERT INTO bookmarks_fts (rowid, title, url, description, notes, tags)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.title, row.url, row.description, notesText, row.tags);
}

export function removeFromIndex(db: Database.Database, bookmarkId: number): void {
  db.prepare(`DELETE FROM bookmarks_fts WHERE rowid = ?`).run(bookmarkId);
}
