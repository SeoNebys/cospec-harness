import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'

// FR-015 (permanent delete) and FR-016 (reversible archive/restore).
describe('archive / restore', () => {
  it('archiving removes a bookmark from the active list but keeps it in archived', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    const res = svc.save({ url: 'https://example.com/a', title: 'A' })
    if (!res.ok) throw new Error('save failed')

    svc.setArchived(res.bookmark.id, true)
    expect(svc.listActive().map((b) => b.id)).not.toContain(res.bookmark.id)
    expect(svc.listArchived().map((b) => b.id)).toContain(res.bookmark.id)

    // restore
    svc.setArchived(res.bookmark.id, false)
    expect(svc.listActive().map((b) => b.id)).toContain(res.bookmark.id)
    expect(svc.listArchived()).toHaveLength(0)
  })
})

describe('permanent delete', () => {
  it('removes the bookmark entirely and reports its files for cleanup', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    const res = svc.save({ url: 'https://example.com/b', title: 'B' })
    if (!res.ok) throw new Error('save failed')

    const { files } = svc.remove(res.bookmark.id)
    expect(Array.isArray(files)).toBe(true)
    expect(svc.getById(res.bookmark.id)).toBeNull()
    expect(svc.listActive()).toHaveLength(0)
    expect(svc.listArchived()).toHaveLength(0)
  })
})

describe('editing', () => {
  it('saves a sanitized note and keeps a plain-text copy for search', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    const res = svc.save({ url: 'https://example.com/c', title: 'C' })
    if (!res.ok) throw new Error('save failed')

    const upd = svc.update(res.bookmark.id, {
      noteHtml: '<p>Keep <strong>this</strong></p><script>alert(1)</script>'
    })
    expect(upd.ok).toBe(true)
    if (upd.ok) {
      expect(upd.bookmark.noteHtml).toContain('<strong>this</strong>')
      expect((upd.bookmark.noteHtml ?? '').toLowerCase()).not.toContain('<script')
      expect(upd.bookmark.noteText).toBe('Keep this')
    }
  })

  it('rejects editing the address to one another bookmark already uses', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    const a = svc.save({ url: 'https://example.com/one' })
    const b = svc.save({ url: 'https://example.com/two' })
    if (!a.ok || !b.ok) throw new Error('save failed')

    const upd = svc.update(b.bookmark.id, { url: 'https://example.com/one' })
    expect(upd.ok).toBe(false)
    if (!upd.ok) expect(upd.error).toBe('duplicate')
  })
})
