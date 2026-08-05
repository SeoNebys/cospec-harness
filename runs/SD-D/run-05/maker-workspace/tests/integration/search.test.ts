import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { TagsService } from '../../src/main/services/tags'
import { SearchService, SavedSearchesService } from '../../src/main/services/search'

function setup() {
  const db = openDatabase(':memory:')
  const bookmarks = new BookmarksService({ db })
  const tags = new TagsService(db)
  const search = new SearchService(db)
  const saved = new SavedSearchesService(db, search)
  return { db, bookmarks, tags, search, saved }
}

function idOf(url: string, bookmarks: BookmarksService): string {
  const res = bookmarks.save({ url })
  if (!res.ok) throw new Error('save failed')
  return res.bookmark.id
}

describe('search across fields, case-insensitive', () => {
  it('finds a bookmark by a word that appears only in its note, ignoring case (FR-018)', () => {
    const { bookmarks, search } = setup()
    const id = idOf('https://example.com/pasta', bookmarks)
    bookmarks.update(id, { title: 'Dinner', noteHtml: '<p>Great <strong>Carbonara</strong> method</p>' })

    expect(search.search({ text: 'carbonara' }).map((b) => b.id)).toContain(id)
    expect(search.search({ text: 'CARBONARA' }).map((b) => b.id)).toContain(id)
  })

  it('supports exact-phrase search in quotes (FR-020)', () => {
    const { bookmarks, search } = setup()
    const a = idOf('https://example.com/a', bookmarks)
    const b = idOf('https://example.com/b', bookmarks)
    bookmarks.update(a, { title: 'olive oil and garlic' })
    bookmarks.update(b, { title: 'oil from olive groves' })

    const phrase = search.search({ text: '"olive oil"' }).map((x) => x.id)
    expect(phrase).toContain(a)
    expect(phrase).not.toContain(b)
  })
})

describe('tag scoping and exclusion of archived (FR-021, FR-023a)', () => {
  it('narrows a keyword to a tag, and either-of-two tags', () => {
    const { bookmarks, tags, search } = setup()
    const r1 = idOf('https://example.com/r1', bookmarks)
    const r2 = idOf('https://example.com/r2', bookmarks)
    const other = idOf('https://example.com/o', bookmarks)
    bookmarks.update(r1, { title: 'pasta bake' })
    bookmarks.update(r2, { title: 'pasta salad' })
    bookmarks.update(other, { title: 'pasta museum' })
    tags.assign(r1, ['recipes'])
    tags.assign(r2, ['cooking'])

    // keyword + single tag
    expect(search.search({ text: 'pasta', tags: ['recipes'] }).map((b) => b.id)).toEqual([r1])
    // either of two tags
    const either = search.search({ text: 'pasta', tags: ['recipes', 'cooking'], tagMode: 'or' }).map((b) => b.id)
    expect(either.sort()).toEqual([r1, r2].sort())
    expect(either).not.toContain(other)
  })

  it('excludes archived bookmarks from everyday results (FR-023a)', () => {
    const { bookmarks, search } = setup()
    const active = idOf('https://example.com/active', bookmarks)
    const archived = idOf('https://example.com/archived', bookmarks)
    bookmarks.update(active, { title: 'shared keyword here' })
    bookmarks.update(archived, { title: 'shared keyword here too' })
    bookmarks.setArchived(archived, true)

    const results = search.search({ text: 'shared' }).map((b) => b.id)
    expect(results).toContain(active)
    expect(results).not.toContain(archived)

    // ...but they are found when archived is explicitly included.
    const withArchived = search.search({ text: 'shared', includeArchived: true }).map((b) => b.id)
    expect(withArchived).toContain(archived)
  })
})

describe('saved searches (FR-023)', () => {
  it('re-evaluates stored criteria against the current collection', () => {
    const { bookmarks, tags, search, saved } = setup()
    const s = saved.create({ name: 'unread recipes', tags: ['recipes'], unreadOnly: true })

    // no matches yet
    expect(saved.run(s.id)).toHaveLength(0)

    // add a matching bookmark after saving the search
    const id = idOf('https://example.com/new', bookmarks)
    tags.assign(id, ['recipes'])
    const ran = saved.run(s.id).map((b) => b.id)
    expect(ran).toContain(id)
    void search // referenced to keep setup shape clear
  })
})
