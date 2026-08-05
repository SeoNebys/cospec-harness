import type { Bookmark } from '@shared/types'
import type { BookmarksService } from './bookmarks'
import type { SavedCopiesService } from './savedCopies'
import type { FileStore } from '../storage/files'
import { parseMetadata } from './metadata'
import { extractReadable, isPdf } from './capture'

// A fetch-like function returning enough of a Response for ingest. Defaults to
// the platform fetch; tests inject a fake so no network is touched.
export type IngestFetch = (url: string) => Promise<{
  ok: boolean
  headers?: { get(name: string): string | null }
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}>

export interface IngestDeps {
  bookmarks: BookmarksService
  savedCopies: SavedCopiesService
  files: FileStore
  fetchFn?: IngestFetch
}

// Background job run once, at save time, for each new bookmark (Decision 8):
// fetches the page a single time, fills in any blank title/description and the
// favicon (FR-003/005), and captures the saved copy — a sanitized readable
// article, or the retained PDF, or "unavailable" (FR-007/008/009). The copy is
// taken now, so it reflects the page as it was and survives later changes.
export function makeIngestJob(bookmark: Bookmark, deps: IngestDeps): () => Promise<void> {
  const fetchFn = deps.fetchFn ?? (globalThis.fetch as unknown as IngestFetch)

  return async () => {
    const copyId = deps.savedCopies.ensurePending(bookmark.id)

    let res: Awaited<ReturnType<IngestFetch>>
    try {
      res = await fetchFn(bookmark.url)
    } catch {
      deps.savedCopies.markUnavailable(copyId)
      return
    }
    if (!res.ok) {
      deps.savedCopies.markUnavailable(copyId)
      return
    }

    const contentType = res.headers?.get('content-type') ?? null

    // PDF target: keep the file itself (FR-008).
    if (isPdf(contentType, bookmark.url)) {
      try {
        const buf = Buffer.from(await res.arrayBuffer())
        const path = deps.files.writePdfCopy(bookmark.id, buf)
        deps.savedCopies.markCaptured(copyId, 'pdf', path)
      } catch {
        deps.savedCopies.markUnavailable(copyId)
      }
      return
    }

    // Normal web page: metadata + favicon + readable copy.
    const html = await res.text()
    const meta = parseMetadata(html, bookmark.url)

    let faviconPath: string | null = null
    if (meta.faviconUrl) {
      try {
        const fres = await (globalThis.fetch as typeof fetch)(meta.faviconUrl)
        if (fres.ok) {
          const buf = Buffer.from(await fres.arrayBuffer())
          const ext = meta.faviconUrl.split('.').pop()?.split('?')[0]?.slice(0, 5) || 'ico'
          faviconPath = deps.files.writeFavicon(bookmark.id, ext, buf)
        }
      } catch {
        // favicon is optional
      }
    }

    const reader = extractReadable(html, bookmark.url)
    if (reader) {
      const path = deps.files.writeReaderCopy(bookmark.id, reader.html)
      deps.savedCopies.markCaptured(copyId, 'reader', path)
      deps.bookmarks.applyFetchedMetadata(bookmark.id, {
        title: meta.title ?? reader.title,
        description: meta.description ?? reader.excerpt,
        faviconPath
      })
    } else {
      deps.savedCopies.markUnavailable(copyId)
      deps.bookmarks.applyFetchedMetadata(bookmark.id, {
        title: meta.title,
        description: meta.description,
        faviconPath
      })
    }
  }
}
