import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'

// FR-008 (list active bookmarks) and FR-032 (sort order).
describe('BookmarksService.listActive', () => {
  it('returns an empty list for a fresh collection (drives the empty state)', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    expect(svc.listActive()).toEqual([])
  })

  it('lists saved bookmarks and orders them by the chosen sort', () => {
    let t = 0
    const svc = new BookmarksService({
      db: openDatabase(':memory:'),
      // deterministic increasing timestamps for ordering assertions
      now: () => new Date(2026, 0, 1, 0, 0, ++t).toISOString()
    })
    svc.save({ url: 'https://example.com/alpha', title: 'Alpha' })
    svc.save({ url: 'https://example.com/charlie', title: 'Charlie' })
    svc.save({ url: 'https://example.com/bravo', title: 'Bravo' })

    const newest = svc.listActive('newest').map((b) => b.title)
    expect(newest).toEqual(['Bravo', 'Charlie', 'Alpha'])

    const oldest = svc.listActive('oldest').map((b) => b.title)
    expect(oldest).toEqual(['Alpha', 'Charlie', 'Bravo'])

    const byTitle = svc.listActive('title').map((b) => b.title)
    expect(byTitle).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('includes derived fields (tags array and saved-copy status) in summaries', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    svc.save({ url: 'https://example.com/z', title: 'Z' })
    const [summary] = svc.listActive()
    expect(summary.tags).toEqual([])
    expect(summary.savedCopyStatus).toBeNull()
  })
})
