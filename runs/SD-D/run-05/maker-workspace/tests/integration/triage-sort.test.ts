import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { SearchService } from '../../src/main/services/search'
import { SettingsService } from '../../src/main/services/settings'

// FR-031 (read later / unread filter) and FR-032 (remembered sort order).
describe('read-later / unread filter', () => {
  it('marks read/unread and filters to unread only', () => {
    const db = openDatabase(':memory:')
    const bookmarks = new BookmarksService({ db })
    const search = new SearchService(db)

    const a = bookmarks.save({ url: 'https://example.com/a' })
    const b = bookmarks.save({ url: 'https://example.com/b' })
    if (!a.ok || !b.ok) throw new Error('save failed')

    // new bookmarks start unread → both appear in the unread filter
    expect(search.search({ unreadOnly: true })).toHaveLength(2)

    // mark one read → it drops out of the unread filter
    bookmarks.setRead(a.bookmark.id, true)
    const unread = search.search({ unreadOnly: true }).map((x) => x.id)
    expect(unread).toEqual([b.bookmark.id])

    // ...but is still there when not filtering
    expect(search.search({})).toHaveLength(2)
  })
})

describe('remembered sort order', () => {
  it('persists and reads back the chosen sort setting', () => {
    const db = openDatabase(':memory:')
    const settings = new SettingsService(db)

    expect(settings.get('sort_order')).toBeNull()
    settings.set('sort_order', 'title')
    expect(settings.get('sort_order')).toBe('title')
    // overwrite
    settings.set('sort_order', 'oldest')
    expect(settings.get('sort_order')).toBe('oldest')
  })
})
