import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { TagsService } from '../../src/main/services/tags'
import { SearchService } from '../../src/main/services/search'
import { BatchService } from '../../src/main/services/batch'

function setup() {
  const db = openDatabase(':memory:')
  const bookmarks = new BookmarksService({ db })
  const tags = new TagsService(db)
  const search = new SearchService(db)
  const removed: string[] = []
  const batch = new BatchService(db, {
    bookmarks,
    tags,
    search,
    onRemoveFiles: (paths) => removed.push(...paths)
  })
  return { db, bookmarks, tags, search, batch, removed }
}

function save(bookmarks: BookmarksService, url: string, title?: string): string {
  const res = bookmarks.save({ url, title })
  if (!res.ok) throw new Error('save failed')
  return res.bookmark.id
}

describe('batch actions over an explicit selection (FR-024)', () => {
  it('adds a tag to several bookmarks at once', () => {
    const { bookmarks, tags, batch } = setup()
    const a = save(bookmarks, 'https://example.com/a')
    const b = save(bookmarks, 'https://example.com/b')
    const c = save(bookmarks, 'https://example.com/c')

    const res = batch.apply({ ids: [a, b] }, { type: 'addTag', tagName: 'reading' })
    expect(res).toEqual({ ok: true, affected: 2 })
    expect(tags.listForBookmark(a)).toContain('reading')
    expect(tags.listForBookmark(b)).toContain('reading')
    expect(tags.listForBookmark(c)).not.toContain('reading')
  })

  it('removes a tag from a whole selection, leaving bookmarks without it unchanged', () => {
    const { bookmarks, tags, batch } = setup()
    const a = save(bookmarks, 'https://example.com/a')
    const b = save(bookmarks, 'https://example.com/b')
    const c = save(bookmarks, 'https://example.com/c')
    // a and b get "recipes"; c never does
    batch.apply({ ids: [a, b] }, { type: 'addTag', tagName: 'recipes' })

    const res = batch.apply({ ids: [a, b, c] }, { type: 'removeTag', tagName: 'recipes' })
    expect(res.ok).toBe(true)
    expect(tags.listForBookmark(a)).not.toContain('recipes')
    expect(tags.listForBookmark(b)).not.toContain('recipes')
    expect(tags.listForBookmark(c)).toEqual([]) // untouched, never had it
  })

  it('marks several read and archives several at once', () => {
    const { bookmarks, batch } = setup()
    const a = save(bookmarks, 'https://example.com/a')
    const b = save(bookmarks, 'https://example.com/b')

    batch.apply({ ids: [a, b] }, { type: 'setRead', value: true })
    expect(bookmarks.getById(a)!.isRead).toBe(true)
    expect(bookmarks.getById(b)!.isRead).toBe(true)

    batch.apply({ ids: [a, b] }, { type: 'archive', value: true })
    expect(bookmarks.listActive()).toHaveLength(0)
    expect(bookmarks.listArchived()).toHaveLength(2)
  })
})

describe('batch over a search/filter result set (FR-025)', () => {
  it('acts on everything a query currently matches', () => {
    const { bookmarks, tags, batch, search } = setup()
    const a = save(bookmarks, 'https://example.com/a', 'pasta one')
    const b = save(bookmarks, 'https://example.com/b', 'pasta two')
    save(bookmarks, 'https://example.com/c', 'unrelated')

    const res = batch.apply({ query: { text: 'pasta' } }, { type: 'addTag', tagName: 'food' })
    expect(res.affected).toBe(2)
    expect(tags.listForBookmark(a)).toContain('food')
    expect(tags.listForBookmark(b)).toContain('food')
    // the query result set matched exactly two
    expect(search.search({ text: 'pasta' })).toHaveLength(2)
  })
})

describe('batch delete guard (FR-026)', () => {
  it('does nothing without confirmation, deletes (and reports files) with it', () => {
    const { bookmarks, batch } = setup()
    const a = save(bookmarks, 'https://example.com/a')
    const b = save(bookmarks, 'https://example.com/b')

    const blocked = batch.apply({ ids: [a, b] }, { type: 'delete', confirmed: false })
    expect(blocked).toEqual({ ok: false, affected: 0 })
    expect(bookmarks.listActive()).toHaveLength(2)

    const done = batch.apply({ ids: [a, b] }, { type: 'delete', confirmed: true })
    expect(done.affected).toBe(2)
    expect(bookmarks.listActive()).toHaveLength(0)
  })
})
