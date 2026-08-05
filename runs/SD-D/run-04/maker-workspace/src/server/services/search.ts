import type { TagFilter } from '../../shared/types';

// Translate a user's free-text query into an FTS5 MATCH expression, and build the
// SQL for a full filter (text + tag any/all/not + view scope + sort).
// Traces to contracts/filter-model.md and FR-009/FR-010/FR-011/FR-014.

/**
 * Build an FTS5 MATCH string from user text. Bare words and quoted "phrases" are
 * each wrapped as FTS phrases and combined with implicit AND (all must match).
 * Quoting a substring keeps its words adjacent (FR-010). Every token is quoted so
 * punctuation can't inject FTS operators. Returns null when there is no text.
 * Case-insensitivity comes from FTS5's default tokenizer (FR-009).
 */
export function buildFtsMatch(text: string | undefined): string | null {
  if (!text) return null;
  const parts: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const phrase = m[1] !== undefined ? m[1] : m[2];
    const cleaned = phrase.replace(/"/g, ' ').trim();
    if (cleaned) parts.push(`"${cleaned}"`);
  }
  return parts.length ? parts.join(' ') : null;
}

function lower(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

/** Build the SELECT that returns matching bookmark rows for a filter. */
export function buildListQuery(filter: TagFilter): BuiltQuery {
  const where: string[] = [];
  const params: unknown[] = [];

  // View scope (contracts/filter-model.md §1).
  const view = filter.view ?? 'all';
  if (view === 'all') where.push('b.archived = 0');
  else if (view === 'readLater') where.push('b.archived = 0 AND b.read_later = 1');
  else if (view === 'archived') where.push('b.archived = 1');

  // Text / phrase (FTS).
  const match = buildFtsMatch(filter.text);
  if (match) {
    where.push('b.id IN (SELECT rowid FROM bookmarks_fts WHERE bookmarks_fts MATCH ?)');
    params.push(match);
  }

  // Tags — any of (OR).
  const any = lower(filter.tagsAny);
  if (any.length) {
    where.push(
      `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                WHERE t.name IN (${any.map(() => '?').join(', ')}))`
    );
    params.push(...any);
  }

  // Tags — all of (AND).
  const all = lower(filter.tagsAll);
  if (all.length) {
    where.push(
      `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                WHERE t.name IN (${all.map(() => '?').join(', ')})
                GROUP BY bt.bookmark_id HAVING COUNT(DISTINCT t.name) = ?)`
    );
    params.push(...all, all.length);
  }

  // Tags — excluding (NOT).
  const not = lower(filter.tagsNot);
  if (not.length) {
    where.push(
      `b.id NOT IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                    WHERE t.name IN (${not.map(() => '?').join(', ')}))`
    );
    params.push(...not);
  }

  // Sort (FR-014).
  const sort = filter.sort ?? 'newest';
  const orderBy =
    sort === 'oldest'
      ? 'b.created_at ASC, b.id ASC'
      : sort === 'title'
        ? 'b.title COLLATE NOCASE ASC, b.id ASC'
        : 'b.created_at DESC, b.id DESC';

  const sql = `SELECT b.* FROM bookmarks b WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`;
  return { sql, params };
}
