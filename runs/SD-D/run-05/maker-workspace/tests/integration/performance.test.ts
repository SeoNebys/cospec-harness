import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { TagsService } from '../../src/main/services/tags'
import { SearchService } from '../../src/main/services/search'

// SC-010 / FR-035: the collection view, search, and filters must stay responsive
// with well over a thousand bookmarks. This inserts a large set and checks the
// common operations return correct results well within a generous time budget.
describe('responsiveness with a large collection', () => {
  it('lists, searches, and tag-filters 1,500 bookmarks quickly', () => {
    const db = openDatabase(':memory:')
    const bookmarks = new BookmarksService({ db })
    const tags = new TagsService(db)
    const search = new SearchService(db)

    const N = 1500
    const insert = db.transaction(() => {
      for (let i = 0; i < N; i++) {
        const res = bookmarks.save({
          url: `https://example.com/page-${i}`,
          title: i % 50 === 0 ? `Special pineapple item ${i}` : `Ordinary item ${i}`
        })
        if (res.ok && i % 100 === 0) tags.assign(res.bookmark.id, ['hundreds'])
      }
    })
    insert()

    const t0 = performance.now()
    const all = bookmarks.listActive('newest')
    const listMs = performance.now() - t0
    expect(all).toHaveLength(N)
    expect(listMs).toBeLessThan(1500)

    const t1 = performance.now()
    const found = search.search({ text: 'pineapple' })
    const searchMs = performance.now() - t1
    expect(found.length).toBe(Math.ceil(N / 50)) // 30
    expect(searchMs).toBeLessThan(1000)

    const t2 = performance.now()
    const tagged = search.search({ tags: ['hundreds'] })
    const tagMs = performance.now() - t2
    expect(tagged.length).toBe(Math.ceil(N / 100)) // 15
    expect(tagMs).toBeLessThan(1000)
  })
})
