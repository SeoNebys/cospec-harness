import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { parseMetadata, fetchMetadata, fallbackTitle } from '../../src/main/services/metadata'

const FIXTURE = `
<!doctype html><html><head>
  <title>Raw Title</title>
  <meta property="og:title" content="Nice Article Title" />
  <meta name="description" content="A short summary of the page." />
  <link rel="icon" href="/assets/favicon.png" />
</head><body><p>Body</p></body></html>`

// FR-003 (auto-fetch title/description/favicon) and FR-005 (fallback).
describe('parseMetadata', () => {
  it('prefers og:title, reads description, resolves favicon to an absolute URL', () => {
    const meta = parseMetadata(FIXTURE, 'https://example.com/post')
    expect(meta.title).toBe('Nice Article Title')
    expect(meta.description).toBe('A short summary of the page.')
    expect(meta.faviconUrl).toBe('https://example.com/assets/favicon.png')
  })

  it('falls back to a default favicon path when none is declared', () => {
    const meta = parseMetadata('<html><head><title>T</title></head></html>', 'https://example.com')
    expect(meta.title).toBe('T')
    expect(meta.faviconUrl).toBe('https://example.com/favicon.ico')
  })
})

describe('fetchMetadata', () => {
  it('returns empty metadata (no throw) when the page is unreachable', async () => {
    const meta = await fetchMetadata('https://example.com', async () => {
      throw new Error('network down')
    })
    expect(meta).toEqual({ title: null, description: null, faviconUrl: null })
  })
})

describe('applyFetchedMetadata (auto-fill after save)', () => {
  it('fills blank fields but never overwrites a title the user typed', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    // user provided their own title, left description blank
    const res = svc.save({ url: 'https://example.com/x', title: 'My Own Title' })
    if (!res.ok) throw new Error('save failed')
    svc.applyFetchedMetadata(res.bookmark.id, {
      title: 'Fetched Title',
      description: 'Fetched description'
    })
    const after = svc.getById(res.bookmark.id)!
    expect(after.title).toBe('My Own Title') // user title preserved
    expect(after.description).toBe('Fetched description') // blank got filled
  })

  it('replaces a fallback title with the fetched one', () => {
    const svc = new BookmarksService({ db: openDatabase(':memory:') })
    const res = svc.save({ url: 'https://example.com/y' }) // no title → fallback
    if (!res.ok) throw new Error('save failed')
    expect(res.bookmark.title).toBe(fallbackTitle('https://example.com/y'))
    svc.applyFetchedMetadata(res.bookmark.id, { title: 'Real Page Title' })
    expect(svc.getById(res.bookmark.id)!.title).toBe('Real Page Title')
  })
})
