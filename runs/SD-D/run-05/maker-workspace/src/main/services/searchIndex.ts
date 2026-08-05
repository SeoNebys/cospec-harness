import type { DB } from '../db/connection'

// Keeps the full-text index (bookmarks_fts) in step with a bookmark's current
// content. Called whenever a bookmark's indexed fields change — created, edited,
// metadata filled, or tags changed — so search always reflects the latest data
// (FR-018). Implemented as delete-then-insert so it is safe to call repeatedly.
export function reindexBookmark(db: DB, bookmarkId: string): void {
  db.prepare('DELETE FROM bookmarks_fts WHERE bookmark_id = ?').run(bookmarkId)
  const b = db
    .prepare('SELECT id, title, description, note_text, url FROM bookmarks WHERE id = ?')
    .get(bookmarkId) as
    | { id: string; title: string; description: string; note_text: string | null; url: string }
    | undefined
  if (!b) return
  const tags = db
    .prepare(
      `SELECT group_concat(t.name, ' ') AS names FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?`
    )
    .get(bookmarkId) as { names: string | null } | undefined
  db.prepare(
    `INSERT INTO bookmarks_fts (bookmark_id, title, description, note_text, tags, url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(b.id, b.title, b.description, b.note_text ?? '', tags?.names ?? '', b.url)
}

export function removeFromIndex(db: DB, bookmarkId: string): void {
  db.prepare('DELETE FROM bookmarks_fts WHERE bookmark_id = ?').run(bookmarkId)
}
