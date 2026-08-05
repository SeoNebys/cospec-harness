import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { TagsService } from '../../src/main/services/tags'
import { ImportExportService, parseNetscape } from '../../src/main/services/importExport'

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Recipes</H3>
  <DL><p>
    <DT><A HREF="https://example.com/pasta">Pasta</A>
    <DT><A HREF="https://example.com/bread">Bread</A>
  </DL><p>
  <DT><A HREF="not-a-url">Broken</A>
</DL><p>`

function setup() {
  const db = openDatabase(':memory:')
  const bookmarks = new BookmarksService({ db }) // no onCreated → no network in tests
  const tags = new TagsService(db)
  const io = new ImportExportService(db, { bookmarks, tags })
  return { db, bookmarks, tags, io }
}

describe('import → dedupe → export round-trip (FR-028/029/030)', () => {
  it('adds new bookmarks, tags them by folder, and reports a summary', () => {
    const { bookmarks, io } = setup()
    const progress: number[] = []
    const summary = io.import(SAMPLE, { onProgress: (p) => progress.push(p.processed) })

    expect(summary.added).toBe(2) // pasta + bread
    expect(summary.failed).toBe(1) // "not-a-url"
    expect(bookmarks.listActive()).toHaveLength(2)
    // folder became a tag
    const pasta = bookmarks.listActive().find((b) => b.url.endsWith('/pasta'))!
    expect(pasta.tags).toContain('Recipes')
    expect(progress.length).toBeGreaterThan(0)
  })

  it('skips addresses already present on a second import (one-per-address)', () => {
    const { io, bookmarks } = setup()
    io.import(SAMPLE)
    const second = io.import(SAMPLE)
    expect(second.added).toBe(0)
    expect(second.skipped).toBe(2)
    expect(bookmarks.listActive()).toHaveLength(2) // no duplicates
  })

  it('preserves each bookmark original date-added on import (FR-028a)', () => {
    const { io, bookmarks } = setup()
    const dated = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com/old" ADD_DATE="1300000000">Old link</A>
  <DT><A HREF="https://example.com/fresh">No date</A>
</DL><p>`
    io.import(dated)
    const old = bookmarks.listActive().find((b) => b.url.endsWith('/old'))!
    // 1300000000s = 2011-03-13 — must keep the old date, not "today"
    expect(old.createdAt).toMatch(/^2011-03-13T/)
    // the one without a date falls back to a recent timestamp (this year)
    const fresh = bookmarks.listActive().find((b) => b.url.endsWith('/fresh'))!
    expect(fresh.createdAt >= '2026-01-01').toBe(true)
  })

  it('round-trips the saved date through export and re-import (FR-030)', () => {
    const { io } = setup()
    io.import(`<DL><p><DT><A HREF="https://example.com/old" ADD_DATE="1300000000">Old</A></DL><p>`)
    const reparsed = parseNetscape(io.buildExport())
    expect(reparsed[0].savedAt).toMatch(/^2011-03-13T/)
  })

  it('exports a portable file that re-imports to the same links', () => {
    const { io } = setup()
    io.import(SAMPLE)
    const html = io.buildExport()

    const reparsed = parseNetscape(html).map((i) => i.url).sort()
    expect(reparsed).toEqual(['https://example.com/bread', 'https://example.com/pasta'])
  })
})
