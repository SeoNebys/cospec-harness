import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { SavedCopiesService } from '../../src/main/services/savedCopies'
import { FileStore } from '../../src/main/storage/files'
import { extractReadable } from '../../src/main/services/capture'
import { makeIngestJob, type IngestFetch } from '../../src/main/services/ingest'

const ARTICLE = `<!doctype html><html><head><title>My Article</title>
  <meta name="description" content="Summary." /></head>
  <body><article>
    <h1>My Article</h1>
    <p>This is the first substantial paragraph of the article body that
       Readability should keep as the readable content for offline reading.</p>
    <p>A second meaningful paragraph so the extractor has enough to work with.</p>
    <script>window.evil = 'should be stripped'</script>
  </article></body></html>`

// FR-007: capture a sanitized readable copy that can be read offline.
describe('extractReadable', () => {
  it('keeps the article text and strips scripts', () => {
    const result = extractReadable(ARTICLE, 'https://example.com/post')
    expect(result).not.toBeNull()
    expect(result!.html).toContain('first substantial paragraph')
    expect(result!.html.toLowerCase()).not.toContain('<script')
    expect(result!.html).not.toContain('should be stripped')
  })
})

describe('ingest → reader copy (no network)', () => {
  function fakeFetch(html: string): IngestFetch {
    return async () => ({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => html,
      arrayBuffer: async () => new ArrayBuffer(0)
    })
  }

  it('captures a reader copy at save time and stores it as a local file', async () => {
    const db = openDatabase(':memory:')
    const bookmarks = new BookmarksService({ db })
    const savedCopies = new SavedCopiesService(db)
    const files = new FileStore(mkdtempSync(join(tmpdir(), 'copies-')))

    const res = bookmarks.save({ url: 'https://example.com/post' })
    if (!res.ok) throw new Error('save failed')

    const job = makeIngestJob(res.bookmark, {
      bookmarks,
      savedCopies,
      files,
      fetchFn: fakeFetch(ARTICLE)
    })
    await job()

    const copy = savedCopies.getForBookmark(res.bookmark.id)!
    expect(copy.status).toBe('captured')
    expect(copy.kind).toBe('reader')
    expect(copy.filePath).toBeTruthy()

    // The stored copy is readable straight from disk (offline read-back).
    const stored = readFileSync(copy.filePath!, 'utf8')
    expect(stored).toContain('first substantial paragraph')

    // Metadata was filled in from the same fetch.
    const b = bookmarks.getById(res.bookmark.id)!
    expect(b.title).toBe('My Article')
    expect(b.description).toBe('Summary.')
  })

  it('marks the copy unavailable when the page cannot be fetched', async () => {
    const db = openDatabase(':memory:')
    const bookmarks = new BookmarksService({ db })
    const savedCopies = new SavedCopiesService(db)
    const files = new FileStore(mkdtempSync(join(tmpdir(), 'copies-')))
    const res = bookmarks.save({ url: 'https://example.com/gone' })
    if (!res.ok) throw new Error('save failed')

    const job = makeIngestJob(res.bookmark, {
      bookmarks,
      savedCopies,
      files,
      fetchFn: async () => {
        throw new Error('network down')
      }
    })
    await job()

    expect(savedCopies.getForBookmark(res.bookmark.id)!.status).toBe('unavailable')
  })
})
