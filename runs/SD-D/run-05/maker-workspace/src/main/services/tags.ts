import { randomUUID } from 'node:crypto'
import type { DB } from '../db/connection'
import { reindexBookmark } from './searchIndex'

// Manages tags and their links to bookmarks (FR-016/019/022). Tag names are
// unique case-insensitively, so reusing "Recipes" and "recipes" resolves to one
// tag. Any change reindexes the affected bookmark so tag text is searchable.
export class TagsService {
  private readonly db: DB
  private readonly newId: () => string

  constructor(db: DB, deps: { newId?: () => string } = {}) {
    this.db = db
    this.newId = deps.newId ?? (() => randomUUID())
  }

  private tagIdByName(name: string): string {
    const found = this.db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name) as
      | { id: string }
      | undefined
    if (found) return found.id
    const id = this.newId()
    this.db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name)
    return id
  }

  // Add one or more tags to a bookmark, creating any that don't exist yet.
  assign(bookmarkId: string, names: string[]): void {
    const link = this.db.prepare(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    )
    for (const raw of names) {
      const name = raw.trim()
      if (!name) continue
      link.run(bookmarkId, this.tagIdByName(name))
    }
    reindexBookmark(this.db, bookmarkId)
  }

  // Remove a tag from a bookmark (the tag itself is kept for reuse/suggestions).
  remove(bookmarkId: string, name: string): void {
    this.db
      .prepare(
        `DELETE FROM bookmark_tags
          WHERE bookmark_id = ?
            AND tag_id = (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)`
      )
      .run(bookmarkId, name)
    reindexBookmark(this.db, bookmarkId)
  }

  // Existing tag names starting with the typed text, to encourage reuse over
  // near-duplicates (FR-022).
  suggest(prefix: string, limit = 8): string[] {
    const p = prefix.trim().replace(/[%_]/g, '') // strip LIKE wildcards
    if (!p) return []
    return this.db
      .prepare('SELECT name FROM tags WHERE name LIKE ? ORDER BY name COLLATE NOCASE LIMIT ?')
      .all(`${p}%`, limit)
      .map((r) => (r as { name: string }).name)
  }

  listForBookmark(bookmarkId: string): string[] {
    return this.db
      .prepare(
        `SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
          WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE`
      )
      .all(bookmarkId)
      .map((r) => (r as { name: string }).name)
  }
}
