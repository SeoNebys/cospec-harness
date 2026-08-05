import type BetterSqlite3 from "better-sqlite3";
import type { BookmarkRow } from "../models/types.js";

export interface ListParams {
  q?: string;
  tag?: string;
}

/** Turn a free-text query into a safe FTS5 prefix-match expression. */
function toMatchExpr(q: string): string | null {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  // Quote each token (escaping embedded quotes) and add a prefix wildcard.
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(" ");
}

/**
 * Return bookmark rows matching an optional search term (title/url/note via FTS)
 * and/or an optional tag filter, ordered newest-first (FR-005, FR-006, FR-009).
 */
export function listBookmarkRows(db: BetterSqlite3.Database, params: ListParams): BookmarkRow[] {
  const clauses: string[] = [];
  const args: unknown[] = [];
  let from = "FROM bookmarks b";

  if (params.q && params.q.trim()) {
    const match = toMatchExpr(params.q);
    if (match === null) return [];
    // FTS5 requires the table name (not an alias) on the left of MATCH.
    from += " JOIN bookmarks_fts ON bookmarks_fts.rowid = b.id";
    clauses.push("bookmarks_fts MATCH ?");
    args.push(match);
  }

  if (params.tag && params.tag.trim()) {
    from +=
      " JOIN bookmark_tags bt ON bt.bookmark_id = b.id" +
      " JOIN tags t ON t.id = bt.tag_id";
    clauses.push("t.name = ? COLLATE NOCASE");
    args.push(params.tag.trim());
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT b.* ${from} ${where} ORDER BY b.created_at DESC, b.id DESC`;
  return db.prepare(sql).all(...args) as BookmarkRow[];
}
