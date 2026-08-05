import { randomUUID } from 'node:crypto'
import type { DB } from '../db/connection'
import type { Bookmark, BookmarkSummary, BookmarkEdit, SaveResult, SortOrder, UpdateResult } from '@shared/types'
import { isValidWebUrl, normalizeUrl } from './urls'
import { fallbackTitle } from './metadata'
import { sanitizeNoteHtml, htmlToText } from './notes'
import { reindexBookmark, removeFromIndex } from './searchIndex'

interface Deps {
  db: DB
  now?: () => string
  newId?: () => string
  // Called after a new bookmark is created so metadata/copy capture can run in
  // the background (wired to the WorkQueue in production; a no-op in tests).
  onCreated?: (bookmark: Bookmark) => void
}

export type BookmarkRow = {
  id: string
  url: string
  title: string
  description: string
  favicon_path: string | null
  note_html: string | null
  note_text: string | null
  is_read: number
  is_archived: number
  saved_copy_id: string | null
  created_at: string
  updated_at: string
}

export function toBookmark(r: BookmarkRow): Bookmark {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    description: r.description,
    faviconPath: r.favicon_path,
    noteHtml: r.note_html,
    noteText: r.note_text,
    isRead: !!r.is_read,
    isArchived: !!r.is_archived,
    savedCopyId: r.saved_copy_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export class BookmarksService {
  private readonly db: DB
  private readonly now: () => string
  private readonly newId: () => string
  private readonly onCreated: (b: Bookmark) => void

  constructor(deps: Deps) {
    this.db = deps.db
    this.now = deps.now ?? (() => new Date().toISOString())
    this.newId = deps.newId ?? (() => randomUUID())
    this.onCreated = deps.onCreated ?? (() => {})
  }

  private findByUrl(normalized: string): Bookmark | null {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE url = ?').get(normalized) as
      | BookmarkRow
      | undefined
    return row ? toBookmark(row) : null
  }

  getById(id: string): Bookmark | null {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as
      | BookmarkRow
      | undefined
    return row ? toBookmark(row) : null
  }

  // Save a new bookmark. Rejects invalid addresses (FR-002); if the address
  // already exists, returns the existing bookmark with duplicate=true instead
  // of creating a second copy (FR-017, SC-011). Metadata capture is handed to
  // the background queue via onCreated (FR-006).
  save(input: { url: string; title?: string; description?: string; createdAt?: string }): SaveResult {
    if (!isValidWebUrl(input.url)) {
      return {
        ok: false,
        error: 'invalid-url',
        message: 'Enter a full web address starting with http:// or https://'
      }
    }
    const url = normalizeUrl(input.url)

    const existing = this.findByUrl(url)
    if (existing) {
      return { ok: true, duplicate: true, bookmark: existing }
    }

    const ts = this.now()
    // Preserve an original saved date when provided (e.g. from an import), so
    // recency sorting stays meaningful (FR-028a); otherwise use now.
    const createdAt = input.createdAt ?? ts
    const bookmark: Bookmark = {
      id: this.newId(),
      url,
      title: input.title?.trim() || fallbackTitle(url),
      description: input.description?.trim() || '',
      faviconPath: null,
      noteHtml: null,
      noteText: null,
      isRead: false,
      isArchived: false,
      savedCopyId: null,
      createdAt,
      updatedAt: ts
    }

    this.db
      .prepare(
        `INSERT INTO bookmarks
           (id, url, title, description, favicon_path, note_html, note_text,
            is_read, is_archived, saved_copy_id, created_at, updated_at)
         VALUES
           (@id, @url, @title, @description, NULL, NULL, NULL, 0, 0, NULL, @createdAt, @updatedAt)`
      )
      .run({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        createdAt: bookmark.createdAt,
        updatedAt: bookmark.updatedAt
      })

    reindexBookmark(this.db, bookmark.id)

    // Whether the user typed a title or not, still fetch metadata to fill in
    // what they left blank (description, favicon) — but off the UI thread.
    this.onCreated(bookmark)
    return { ok: true, duplicate: false, bookmark }
  }

  // Apply edits from a background metadata fetch without clobbering anything the
  // user typed themselves (only fills empty fields / missing favicon).
  applyFetchedMetadata(
    id: string,
    data: { title?: string | null; description?: string | null; faviconPath?: string | null }
  ): void {
    const current = this.getById(id)
    if (!current) return
    const title =
      current.title && !this.isFallback(current) ? current.title : data.title?.trim() || current.title
    const description = current.description || data.description?.trim() || ''
    const faviconPath = current.faviconPath ?? data.faviconPath ?? null
    this.db
      .prepare(
        `UPDATE bookmarks SET title=@title, description=@description,
           favicon_path=@faviconPath, updated_at=@updatedAt WHERE id=@id`
      )
      .run({ id, title, description, faviconPath, updatedAt: this.now() })
    reindexBookmark(this.db, id)
  }

  private isFallback(b: Bookmark): boolean {
    return b.title === fallbackTitle(b.url)
  }

  // User-initiated edit of title, description, address, and personal note
  // (FR-010, FR-011, FR-013). Editing the address to one already saved is
  // rejected as a duplicate (FR-017). Notes are sanitized and a plain-text copy
  // is kept for search (FR-014, FR-018).
  update(id: string, patch: BookmarkEdit): UpdateResult {
    const current = this.getById(id)
    if (!current) {
      return { ok: false, error: 'not-found', message: 'That bookmark no longer exists.' }
    }

    let url = current.url
    if (patch.url !== undefined && normalizeUrl(patch.url || current.url) !== current.url) {
      if (!isValidWebUrl(patch.url)) {
        return {
          ok: false,
          error: 'invalid-url',
          message: 'Enter a full web address starting with http:// or https://'
        }
      }
      url = normalizeUrl(patch.url)
      const clash = this.findByUrl(url)
      if (clash && clash.id !== id) {
        return {
          ok: false,
          error: 'duplicate',
          message: 'Another bookmark already uses that address.'
        }
      }
    }

    const title =
      patch.title !== undefined ? patch.title.trim() || fallbackTitle(url) : current.title
    const description =
      patch.description !== undefined ? patch.description.trim() : current.description
    let noteHtml = current.noteHtml
    let noteText = current.noteText
    if (patch.noteHtml !== undefined) {
      const clean = sanitizeNoteHtml(patch.noteHtml)
      noteHtml = clean || null
      noteText = clean ? htmlToText(clean) : null
    }

    this.db
      .prepare(
        `UPDATE bookmarks SET url=@url, title=@title, description=@description,
           note_html=@noteHtml, note_text=@noteText, updated_at=@updatedAt WHERE id=@id`
      )
      .run({ id, url, title, description, noteHtml, noteText, updatedAt: this.now() })
    reindexBookmark(this.db, id)
    return { ok: true, bookmark: this.getById(id)! }
  }

  // Mark a bookmark read or unread ("read later") (FR-031).
  setRead(id: string, value: boolean): Bookmark | null {
    if (!this.getById(id)) return null
    this.db
      .prepare('UPDATE bookmarks SET is_read=@v, updated_at=@updatedAt WHERE id=@id')
      .run({ id, v: value ? 1 : 0, updatedAt: this.now() })
    return this.getById(id)
  }

  // Archive (set aside) or restore a bookmark — reversible, distinct from
  // permanent deletion (FR-016).
  setArchived(id: string, value: boolean): Bookmark | null {
    if (!this.getById(id)) return null
    this.db
      .prepare('UPDATE bookmarks SET is_archived=@v, updated_at=@updatedAt WHERE id=@id')
      .run({ id, v: value ? 1 : 0, updatedAt: this.now() })
    return this.getById(id)
  }

  // Permanently delete a bookmark and its tag links + saved-copy rows (cascade).
  // Returns the on-disk file paths so the caller can also remove the stored
  // favicon and saved copy (FR-015). Callers must have confirmed the deletion.
  remove(id: string): { files: string[] } {
    const files: string[] = []
    const current = this.getById(id)
    if (!current) return { files }
    if (current.faviconPath) files.push(current.faviconPath)
    const copy = this.db
      .prepare('SELECT file_path FROM saved_copies WHERE bookmark_id = ?')
      .get(id) as { file_path: string | null } | undefined
    if (copy?.file_path) files.push(copy.file_path)
    this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
    removeFromIndex(this.db, id)
    return { files }
  }

  // List active (non-archived) bookmarks in the chosen order (FR-008, FR-032).
  listActive(sort: SortOrder = 'newest'): BookmarkSummary[] {
    return this.listByArchived(false, sort)
  }

  // List archived (set-aside) bookmarks (FR-016).
  listArchived(sort: SortOrder = 'newest'): BookmarkSummary[] {
    return this.listByArchived(true, sort)
  }

  private listByArchived(archived: boolean, sort: SortOrder): BookmarkSummary[] {
    const orderBy =
      sort === 'title'
        ? 'title COLLATE NOCASE ASC'
        : sort === 'oldest'
          ? 'created_at ASC'
          : 'created_at DESC'
    const rows = this.db
      .prepare(`SELECT * FROM bookmarks WHERE is_archived = ? ORDER BY ${orderBy}`)
      .all(archived ? 1 : 0) as BookmarkRow[]
    return rows.map((r) => hydrateSummary(this.db, toBookmark(r)))
  }
}

// Adds the derived fields the list/search views need (tags, saved-copy status)
// to a bookmark. Shared by browsing and search so both show the same shape.
export function hydrateSummary(db: DB, b: Bookmark): BookmarkSummary {
  const tags = db
    .prepare(
      `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
        WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE`
    )
    .all(b.id)
    .map((r) => (r as { name: string }).name)
  const copy = db
    .prepare('SELECT status FROM saved_copies WHERE bookmark_id = ?')
    .get(b.id) as { status: BookmarkSummary['savedCopyStatus'] } | undefined
  return { ...b, tags, savedCopyStatus: copy?.status ?? null }
}
