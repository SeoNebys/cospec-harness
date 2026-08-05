import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { SavedCopiesService } from '../../src/main/services/savedCopies'
import { FileStore } from '../../src/main/storage/files'
import { isPdf } from '../../src/main/services/capture'
import { makeIngestJob, type IngestFetch } from '../../src/main/services/ingest'

// FR-008: a PDF target is detected and the PDF file itself is retained.
describe('isPdf', () => {
  it('detects PDFs by content type and by address', () => {
    expect(isPdf('application/pdf', 'https://example.com/x')).toBe(true)
    expect(isPdf(null, 'https://example.com/report.pdf')).toBe(true)
    expect(isPdf('text/html', 'https://example.com/page')).toBe(false)
  })
})

describe('ingest → PDF retention (no network)', () => {
  it('retains the PDF file and marks the copy captured as a pdf', async () => {
    const db = openDatabase(':memory:')
    const bookmarks = new BookmarksService({ db })
    const savedCopies = new SavedCopiesService(db)
    const files = new FileStore(mkdtempSync(join(tmpdir(), 'copies-')))

    const pdfBytes = Buffer.from('%PDF-1.4 fake pdf body', 'utf8')
    const fetchFn: IngestFetch = async () => ({
      ok: true,
      headers: { get: () => 'application/pdf' },
      text: async () => '',
      arrayBuffer: async () => pdfBytes.buffer.slice(0, pdfBytes.length)
    })

    const res = bookmarks.save({ url: 'https://example.com/report.pdf' })
    if (!res.ok) throw new Error('save failed')

    await makeIngestJob(res.bookmark, { bookmarks, savedCopies, files, fetchFn })()

    const copy = savedCopies.getForBookmark(res.bookmark.id)!
    expect(copy.status).toBe('captured')
    expect(copy.kind).toBe('pdf')
    expect(copy.filePath && existsSync(copy.filePath)).toBe(true)
  })
})
