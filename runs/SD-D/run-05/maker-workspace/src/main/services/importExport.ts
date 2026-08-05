import type { DB } from '../db/connection'
import type { ImportProgress, ImportSummary } from '@shared/types'
import type { BookmarksService } from './bookmarks'
import type { TagsService } from './tags'

export interface ImportedItem {
  url: string
  title: string
  folder?: string
  // Original saved date as an ISO string, derived from the file's ADD_DATE.
  savedAt?: string
}

// Common browser root-folder names that make poor tags; skipped when mapping
// folders to tags.
const ROOT_FOLDERS = new Set([
  'bookmarks',
  'bookmarks bar',
  'bookmarks menu',
  'bookmarks toolbar',
  'other bookmarks',
  'favorites',
  'favorites bar'
])

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

// Parses the standard "Netscape Bookmark File" HTML that every major browser
// exports (FR-027). Extracts each link's address and title, and best-effort maps
// the enclosing folder name to a tag. Tolerant of the format's loose nesting.
export function parseNetscape(html: string): ImportedItem[] {
  const items: ImportedItem[] = []
  let currentFolder: string | undefined
  // Matches either a folder heading or an anchor (capturing the anchor's full
  // attribute list so ADD_DATE and HREF can be read from it).
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<a\s+([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== undefined) {
      const name = decodeEntities(stripTags(m[1])).trim()
      currentFolder = name && !ROOT_FOLDERS.has(name.toLowerCase()) ? name : undefined
    } else if (m[2] !== undefined) {
      const attrs = m[2]
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1]
      if (!href) continue
      const title = decodeEntities(stripTags(m[3] ?? '')).trim()
      // ADD_DATE is Unix seconds in the Netscape format.
      const addDate = /add_date\s*=\s*"?(\d+)"?/i.exec(attrs)?.[1]
      const savedAt =
        addDate && Number(addDate) > 0 ? new Date(Number(addDate) * 1000).toISOString() : undefined
      items.push({ url: decodeEntities(href).trim(), title, folder: currentFolder, savedAt })
    }
  }
  return items
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export class ImportExportService {
  private readonly db: DB
  private readonly bookmarks: BookmarksService
  private readonly tags: TagsService

  constructor(db: DB, deps: { bookmarks: BookmarksService; tags: TagsService }) {
    this.db = db
    this.bookmarks = deps.bookmarks
    this.tags = deps.tags
  }

  // Imports a Netscape bookmarks file. Adds new bookmarks (each enqueues its own
  // background metadata/copy capture via save), skips addresses already present
  // (one-per-address, FR-028), and reports a running + final summary (FR-029).
  import(html: string, opts: { onProgress?: (p: ImportProgress) => void } = {}): ImportSummary {
    const items = parseNetscape(html)
    const total = items.length
    let added = 0
    let skipped = 0
    let failed = 0

    items.forEach((item, i) => {
      const res = this.bookmarks.save({
        url: item.url,
        title: item.title || undefined,
        createdAt: item.savedAt // preserve the original date-added (FR-028a)
      })
      if (!res.ok) {
        failed++
      } else if (res.duplicate) {
        skipped++
      } else {
        added++
        if (item.folder) this.tags.assign(res.bookmark.id, [item.folder])
      }
      if (opts.onProgress && (i % 25 === 0 || i === total - 1)) {
        opts.onProgress({ processed: i + 1, total, added, skipped, failed })
      }
    })

    return { added, skipped, failed }
  }

  // Exports the whole collection (active and archived) to a portable Netscape
  // bookmarks file that can be re-imported here or into a browser (FR-030).
  buildExport(): string {
    const rows = this.db
      .prepare('SELECT url, title, created_at FROM bookmarks ORDER BY created_at ASC')
      .all() as { url: string; title: string; created_at: string }[]
    const lines = rows.map((r) => {
      const addDate = Math.floor(Date.parse(r.created_at) / 1000) || 0
      return `        <DT><A HREF="${escapeHtml(r.url)}" ADD_DATE="${addDate}">${escapeHtml(r.title)}</A>`
    })
    return [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>',
      ...lines,
      '</DL><p>',
      ''
    ].join('\n')
  }

  countAll(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM bookmarks').get() as { n: number }).n
  }
}
