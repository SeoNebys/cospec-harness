import type { DB } from '../../db/db.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { parseQuery } from './parser.ts';
import { compileAst, type SqlFragment } from './compile.ts';

export type Scope = 'active' | 'unread' | 'archived' | 'all';

export interface ViewCriteria {
  q?: string;
  tags?: string[]; // simple AND tag filters (equivalent to `#tag` terms)
  view?: number; // saved-view id
  scope?: Scope;
}

const SORTS: Record<string, string> = {
  date_added_desc: 'b.date_added DESC',
  date_added_asc: 'b.date_added ASC',
  date_modified_desc: 'b.date_modified DESC',
  date_modified_asc: 'b.date_modified ASC',
  title_asc: "COALESCE(b.title_user, b.title_captured, b.url) COLLATE NOCASE ASC",
  title_desc: "COALESCE(b.title_user, b.title_captured, b.url) COLLATE NOCASE DESC",
  unread_first: 'b.is_unread DESC, b.date_added DESC',
};

export function orderByClause(sort?: string, fallback = 'date_added_desc'): string {
  return SORTS[sort ?? ''] ?? SORTS[fallback] ?? SORTS.date_added_desc;
}

function tagFragment(name: string): SqlFragment {
  return {
    sql:
      '(EXISTS (SELECT 1 FROM bookmark_tag bt JOIN tag t ON t.id = bt.tag_id ' +
      'WHERE bt.bookmark_id = b.id AND t.name = ?))',
    params: [name.trim().toLowerCase()],
  };
}

/**
 * The SINGLE shared query builder used by BOTH listing and bulk "select all
 * matching" (plan.md bulk-parity; FR-019). Produces a WHERE clause over alias
 * `b` for a `bookmark b` query. When `view` is given, the saved view's query
 * AND its included/excluded tags are applied in full.
 */
export function resolveView(db: DB, criteria: ViewCriteria): SqlFragment {
  const clauses: string[] = [];
  const params: unknown[] = [];

  // Scope.
  const scope = criteria.scope ?? 'active';
  if (scope === 'active') clauses.push('b.is_archived = 0');
  else if (scope === 'unread') clauses.push('b.is_archived = 0 AND b.is_unread = 1');
  else if (scope === 'archived') clauses.push('b.is_archived = 1');
  // 'all' adds no archive constraint.

  const addQuery = (q?: string) => {
    if (q && q.trim()) {
      const ast = parseQuery(q);
      if (ast) {
        const frag = compileAst(ast);
        clauses.push(frag.sql);
        params.push(...frag.params);
      }
    }
  };

  const addTags = (tags?: string[]) => {
    for (const name of tags ?? []) {
      if (!name || !name.trim()) continue;
      const frag = tagFragment(name);
      clauses.push(frag.sql);
      params.push(...frag.params);
    }
  };

  // Ad-hoc query + simple tag filters.
  addQuery(criteria.q);
  addTags(criteria.tags);

  // Saved view: apply its query + include/exclude tags in full.
  if (criteria.view != null) {
    const row = db
      .prepare('SELECT query, include_tags, exclude_tags FROM saved_view WHERE id = ?')
      .get(criteria.view) as
      | { query: string; include_tags: string; exclude_tags: string }
      | undefined;
    if (!row) throw notFound(`Saved view ${criteria.view} not found.`);
    addQuery(row.query);
    let include: string[] = [];
    let exclude: string[] = [];
    try {
      include = JSON.parse(row.include_tags || '[]');
      exclude = JSON.parse(row.exclude_tags || '[]');
    } catch {
      throw badRequest('Saved view has malformed tag lists.');
    }
    addTags(include);
    for (const name of exclude) {
      if (!name || !name.trim()) continue;
      const frag = tagFragment(name);
      clauses.push(`(NOT ${frag.sql})`);
      params.push(...frag.params);
    }
  }

  const sql = clauses.length ? clauses.join(' AND ') : '1=1';
  return { sql, params };
}
