import { randomUUID } from 'node:crypto'
import type { DB } from '../db/connection'
import type { SavedCopy, SavedCopyKind } from '@shared/types'

type Row = {
  id: string
  bookmark_id: string
  kind: SavedCopyKind
  file_path: string | null
  status: SavedCopy['status']
  captured_at: string | null
}

function toSavedCopy(r: Row): SavedCopy {
  return {
    id: r.id,
    bookmarkId: r.bookmark_id,
    kind: r.kind,
    filePath: r.file_path,
    status: r.status,
    capturedAt: r.captured_at
  }
}

// Tracks the saved-copy record for each bookmark and its lifecycle:
// pending → captured / unavailable (FR-007/008/009, Decision 8).
export class SavedCopiesService {
  private readonly db: DB
  private readonly newId: () => string
  private readonly now: () => string

  constructor(db: DB, deps: { newId?: () => string; now?: () => string } = {}) {
    this.db = db
    this.newId = deps.newId ?? (() => randomUUID())
    this.now = deps.now ?? (() => new Date().toISOString())
  }

  getForBookmark(bookmarkId: string): SavedCopy | null {
    const row = this.db.prepare('SELECT * FROM saved_copies WHERE bookmark_id = ?').get(bookmarkId) as
      | Row
      | undefined
    return row ? toSavedCopy(row) : null
  }

  // Creates the pending record (once) and links it to the bookmark.
  ensurePending(bookmarkId: string): string {
    const existing = this.getForBookmark(bookmarkId)
    if (existing) return existing.id
    const id = this.newId()
    this.db
      .prepare(
        `INSERT INTO saved_copies (id, bookmark_id, kind, file_path, status, captured_at)
         VALUES (?, ?, 'reader', NULL, 'pending', NULL)`
      )
      .run(id, bookmarkId)
    this.db.prepare('UPDATE bookmarks SET saved_copy_id = ? WHERE id = ?').run(id, bookmarkId)
    return id
  }

  markCaptured(id: string, kind: SavedCopyKind, filePath: string): void {
    this.db
      .prepare(
        `UPDATE saved_copies SET kind = ?, file_path = ?, status = 'captured', captured_at = ?
         WHERE id = ?`
      )
      .run(kind, filePath, this.now(), id)
  }

  markUnavailable(id: string): void {
    this.db.prepare(`UPDATE saved_copies SET status = 'unavailable' WHERE id = ?`).run(id)
  }
}
