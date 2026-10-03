import type { Db } from '../db/client.js';
import type { BookmarkDto, SearchCriteria } from '../../shared/types.js';
import { normalizeName } from '../../shared/normalization.js';
import { mapBookmark } from '../db/repositories/bookmarks.js';
import { parseSearch, type SearchNode } from './parser.js';

type Row = Record<string, any>;
const intersect = (a: Set<number>, b: Set<number>) => new Set([...a].filter((id) => b.has(id)));
const union = (a: Set<number>, b: Set<number>) => new Set([...a, ...b]);
const subtract = (a: Set<number>, b: Set<number>) => new Set([...a].filter((id) => !b.has(id)));

function universe(db: Db, userId: number, criteria: SearchCriteria): Set<number> {
  const where = ['b.user_id=?']; const values: unknown[] = [userId];
  if (criteria.location === 'archive') where.push('b.archived_at IS NOT NULL'); else where.push('b.archived_at IS NULL');
  if (criteria.location === 'unread') where.push("b.read_state='unread'");
  if (criteria.readState) { where.push('b.read_state=?'); values.push(criteria.readState); }
  if (criteria.collectionId) { where.push('c.public_id=?'); values.push(criteria.collectionId); }
  for (const tagId of criteria.tagIds) { where.push('EXISTS(SELECT 1 FROM bookmark_tags fx JOIN tags ft ON ft.id=fx.tag_id WHERE fx.bookmark_id=b.id AND ft.user_id=b.user_id AND ft.public_id=?)'); values.push(tagId); }
  return new Set((db.prepare(`SELECT b.id FROM bookmarks b LEFT JOIN collections c ON c.id=b.collection_id WHERE ${where.join(' AND ')}`).all(...values) as Row[]).map((row) => row.id));
}

function leaf(db: Db, userId: number, node: Extract<SearchNode, { type: 'text' | 'phrase' | 'tag' }>): Set<number> {
  if (node.type === 'tag') {
    const key = normalizeName(node.value).key;
    return new Set((db.prepare(`SELECT bt.bookmark_id id FROM bookmark_tags bt JOIN tags t ON t.id=bt.tag_id WHERE t.user_id=? AND t.name_key=?`).all(userId, key) as Row[]).map((row) => row.id));
  }
  const escaped = node.value.replace(/"/g, '""');
  if (!escaped.trim()) return new Set();
  try { return new Set((db.prepare(`SELECT b.id FROM bookmark_fts f JOIN bookmarks b ON b.id=f.rowid WHERE b.user_id=? AND bookmark_fts MATCH ?`).all(userId, `"${escaped}"`) as Row[]).map((row) => row.id)); }
  catch { return new Set(); }
}

function evaluate(db: Db, userId: number, node: SearchNode, all: Set<number>): Set<number> {
  if (node.type === 'text' || node.type === 'phrase' || node.type === 'tag') return intersect(all, leaf(db, userId, node));
  if (node.type === 'not') return subtract(all, evaluate(db, userId, node.child, all));
  const values = node.children.map((child) => evaluate(db, userId, child, all));
  return values.slice(1).reduce((result, value) => node.type === 'and' ? intersect(result, value) : union(result, value), values[0]);
}

export function searchBookmarks(db: Db, userId: number, criteria: SearchCriteria, cursor: number, limit: number): { items: BookmarkDto[]; total: number; nextCursor: string | null } {
  const all = universe(db, userId, criteria);
  const ast = parseSearch(criteria.query);
  const ids = ast ? evaluate(db, userId, ast, all) : all;
  if (!ids.size) return { items: [], total: 0, nextCursor: null };
  const placeholders = [...ids].map(() => '?').join(',');
  const rows = db.prepare(`SELECT b.*,c.public_id collection_public_id,c.name collection_name FROM bookmarks b LEFT JOIN collections c ON c.id=b.collection_id WHERE b.id IN (${placeholders})`).all(...ids) as Row[];
  rows.sort((a, b) => criteria.sort === 'title' ? a.title_sort_key.localeCompare(b.title_sort_key) || a.id-b.id : criteria.sort === 'oldest' ? a.created_at.localeCompare(b.created_at) || a.id-b.id : b.created_at.localeCompare(a.created_at) || b.id-a.id);
  const page = rows.slice(cursor, cursor + limit);
  return { items: page.map((row) => mapBookmark(db, row)), total: rows.length, nextCursor: cursor + limit < rows.length ? Buffer.from(String(cursor + limit)).toString('base64url') : null };
}

export function decodeCursor(value?: string): number {
  if (!value) return 0;
  const number = Number(Buffer.from(value, 'base64url').toString());
  return Number.isInteger(number) && number >= 0 ? number : 0;
}
