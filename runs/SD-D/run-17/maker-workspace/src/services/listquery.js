// Shared list filtering used by GET /api/bookmarks and bulk selectAll (FR-017/FR-019).
import { allForView, sortBookmarks } from '../models/bookmark.js';
import { parseQuery, evaluate } from './search.js';

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap((x) => String(x).split(','));
  return String(v).split(',');
}

// Returns filtered (and optionally sorted) bookmark list.
// opts: { q, view, include_tags, exclude_tags, sort }
// Throws SearchError on malformed q.
export function queryBookmarks(opts = {}) {
  const view = opts.view || 'normal';
  const ast = parseQuery(opts.q || '');           // may throw SearchError
  const include = toArray(opts.include_tags).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const exclude = toArray(opts.exclude_tags).map((t) => t.trim().toLowerCase()).filter(Boolean);

  let list = allForView(view);
  list = list.filter((bm) => {
    const tagsLower = (bm.tags || []).map((t) => t.toLowerCase());
    if (include.length && !include.every((t) => tagsLower.includes(t))) return false;
    if (exclude.length && exclude.some((t) => tagsLower.includes(t))) return false;
    if (ast && !evaluate(ast, bm)) return false;
    return true;
  });

  if (opts.sort) list = sortBookmarks(list, opts.sort);
  return list;
}
