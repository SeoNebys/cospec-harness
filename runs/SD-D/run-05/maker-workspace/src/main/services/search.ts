import { randomUUID } from 'node:crypto'
import type { DB } from '../db/connection'
import type { BookmarkSummary, SavedSearch, SavedSearchInput, SearchQuery, SortOrder } from '@shared/types'
import { toBookmark, hydrateSummary, type BookmarkRow } from './bookmarks'

export interface ParsedQuery {
  phrases: string[]
  terms: string[]
}

// Splits a search string into quoted exact phrases and bare words (FR-020).
export function parseQuery(text: string): ParsedQuery {
  const phrases: string[] = []
  const terms: string[] = []
  const re = /"([^"]+)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) {
      const p = m[1].trim()
      if (p) phrases.push(p)
    } else if (m[2]) {
      terms.push(m[2])
    }
  }
  return { phrases, terms }
}

// Turns a parsed query into an FTS5 MATCH expression: quoted phrases match
// exactly (FR-020); bare words match as case-insensitive prefixes so partial
// typing still finds results. Returns null when there is nothing to match.
export function buildMatchExpr(q: ParsedQuery): string | null {
  const parts: string[] = []
  for (const p of q.phrases) {
    const clean = p.replace(/"/g, '').trim()
    if (clean) parts.push(`"${clean}"`)
  }
  for (const t of q.terms) {
    const clean = t.replace(/["*]/g, '').trim()
    if (clean) parts.push(`"${clean}"*`)
  }
  return parts.length ? parts.join(' ') : null
}

function orderClause(sort: SortOrder | undefined): string {
  return sort === 'title'
    ? 'title COLLATE NOCASE ASC'
    : sort === 'oldest'
      ? 'created_at ASC'
      : 'created_at DESC'
}

// Runs a combined keyword + tag + state search over bookmarks (FR-018/020/021).
// Archived bookmarks are excluded unless includeArchived is true (FR-023a).
export class SearchService {
  constructor(private readonly db: DB) {}

  search(q: SearchQuery): BookmarkSummary[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (!q.includeArchived) conditions.push('b.is_archived = 0')

    const match = buildMatchExpr(parseQuery(q.text ?? ''))
    if (match) {
      conditions.push('b.id IN (SELECT bookmark_id FROM bookmarks_fts WHERE bookmarks_fts MATCH ?)')
      params.push(match)
    }

    if (q.unreadOnly) conditions.push('b.is_read = 0')

    const names = (q.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 2)
    if (names.length === 2 && q.tagMode === 'and') {
      conditions.push(
        `(SELECT COUNT(DISTINCT t.name) FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
            WHERE bt.bookmark_id = b.id AND t.name IN (?, ?)) = 2`
      )
      params.push(names[0], names[1])
    } else if (names.length >= 1) {
      const placeholders = names.map(() => '?').join(', ')
      conditions.push(
        `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                   WHERE t.name IN (${placeholders}))`
      )
      params.push(...names)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.db
      .prepare(`SELECT b.* FROM bookmarks b ${where} ORDER BY ${orderClause(q.sort)}`)
      .all(...params) as BookmarkRow[]
    return rows.map((r) => hydrateSummary(this.db, toBookmark(r)))
  }
}

type SavedRow = {
  id: string
  name: string
  keywords: string | null
  tag_filter: string | null
  unread_only: number
  include_archived: number
  created_at: string
}

function toSavedSearch(r: SavedRow): SavedSearch {
  return {
    id: r.id,
    name: r.name,
    keywords: r.keywords,
    tagFilter: r.tag_filter,
    unreadOnly: !!r.unread_only,
    includeArchived: !!r.include_archived,
    createdAt: r.created_at
  }
}

// Named, reusable searches stored as criteria (not frozen results), so running
// one reflects the current collection (FR-023).
export class SavedSearchesService {
  private readonly db: DB
  private readonly search: SearchService
  private readonly newId: () => string
  private readonly now: () => string

  constructor(
    db: DB,
    search: SearchService,
    deps: { newId?: () => string; now?: () => string } = {}
  ) {
    this.db = db
    this.search = search
    this.newId = deps.newId ?? (() => randomUUID())
    this.now = deps.now ?? (() => new Date().toISOString())
  }

  create(input: SavedSearchInput): SavedSearch {
    const id = this.newId()
    const tagFilter = (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 2).join(',')
    this.db
      .prepare(
        `INSERT INTO saved_searches (id, name, keywords, tag_filter, unread_only, include_archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name.trim() || 'Saved search',
        input.text?.trim() || null,
        tagFilter || null,
        input.unreadOnly ? 1 : 0,
        input.includeArchived ? 1 : 0,
        this.now()
      )
    return this.getById(id)!
  }

  getById(id: string): SavedSearch | null {
    const row = this.db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id) as
      | SavedRow
      | undefined
    return row ? toSavedSearch(row) : null
  }

  list(): SavedSearch[] {
    return (this.db.prepare('SELECT * FROM saved_searches ORDER BY created_at ASC').all() as SavedRow[]).map(
      toSavedSearch
    )
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM saved_searches WHERE id = ?').run(id)
  }

  // Evaluate a saved search's criteria against the current collection.
  run(id: string, sort?: SortOrder): BookmarkSummary[] {
    const s = this.getById(id)
    if (!s) return []
    const tags = s.tagFilter ? s.tagFilter.split(',').filter(Boolean) : []
    return this.search.search({
      text: s.keywords ?? undefined,
      tags,
      tagMode: 'and',
      unreadOnly: s.unreadOnly,
      includeArchived: s.includeArchived,
      sort
    })
  }
}
