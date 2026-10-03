import { getDb } from '../../db/connection.js';
import { serialize, sortClause } from '../../db/bookmarks.repo.js';
import { parseQuery, SearchSyntaxError } from './parse.js';
import { toSql } from './toSql.js';

// Run a search query. Archived bookmarks are always excluded (FR-018).
// Throws SearchSyntaxError on a malformed query (FR-014).
export function runSearch({ q, sort = 'newest', page = 1, pageSize = 25 }) {
  const ast = parseQuery(q);
  const { sql: whereExpr, params } = toSql(ast);
  const db = getDb();

  const baseWhere = `b.is_archived = 0 AND (${whereExpr})`;

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM bookmark b WHERE ${baseWhere}`)
    .get(...params).n;

  const limit = Math.max(1, Number(pageSize) || 25);
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
  const order = sortClause(sort).replace(/\b(date_added|date_modified|title)\b/g, 'b.$1');

  const rows = db
    .prepare(
      `SELECT b.* FROM bookmark b WHERE ${baseWhere}
       ORDER BY ${order} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { items: rows.map(serialize), total };
}

// Resolve a query + included/excluded tag names to matching bookmark ids
// (used by bulk "select all matching" and saved views, FR-022/FR-024).
export function resolveMatchingIds({ q = null, includedTags = [], excludedTags = [], view = 'all' }) {
  const ast = q ? parseQuery(q) : null;
  const { sql: whereExpr, params } = toSql(ast);
  const clauses = [`(${whereExpr})`];

  if (view === 'archive') clauses.push('b.is_archived = 1');
  else {
    clauses.push('b.is_archived = 0');
    if (view === 'unread') clauses.push('b.is_read = 0');
  }

  for (const tag of includedTags || []) {
    clauses.push(
      `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tag t ON t.id = bt.tag_id
               WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`
    );
    params.push(tag);
  }
  for (const tag of excludedTags || []) {
    clauses.push(
      `NOT EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tag t ON t.id = bt.tag_id
                   WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`
    );
    params.push(tag);
  }

  const rows = getDb()
    .prepare(`SELECT b.id FROM bookmark b WHERE ${clauses.join(' AND ')}`)
    .all(...params);
  return rows.map((r) => r.id);
}

export { SearchSyntaxError };
