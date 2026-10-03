import { listForView } from './bookmarks.js';
import { parse } from './search/parser.js';
import { evaluate } from './search/evaluate.js';
import { SORT_KEYS, DEFAULT_SORT } from '../../shared/constants.js';

function matchesTags(bookmark, includeTags, excludeTags) {
  const tags = new Set((bookmark.tags || []).map((t) => t.toLowerCase()));
  for (const t of includeTags || []) {
    if (!tags.has(String(t).toLowerCase().replace(/^#/, ''))) return false;
  }
  for (const t of excludeTags || []) {
    if (tags.has(String(t).toLowerCase().replace(/^#/, ''))) return false;
  }
  return true;
}

const SORTERS = {
  dateAdded_desc: (a, b) => b.dateAdded.localeCompare(a.dateAdded),
  dateAdded_asc: (a, b) => a.dateAdded.localeCompare(b.dateAdded),
  title_asc: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  title_desc: (a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }),
  dateUpdated_desc: (a, b) => b.dateUpdated.localeCompare(a.dateUpdated),
};

// Returns the full filtered+sorted set (no pagination). Throws SearchSyntaxError
// on a malformed query.
export function selectBookmarks({ view = 'all', q = '', includeTags = [], excludeTags = [], sort } = {}) {
  const ast = parse(q); // throws on malformed
  const sortKey = SORT_KEYS.includes(sort) ? sort : DEFAULT_SORT;
  return listForView(view)
    .filter((b) => matchesTags(b, includeTags, excludeTags))
    .filter((b) => evaluate(ast, b))
    .sort(SORTERS[sortKey]);
}

export function paginate(items, page = 1, pageSize) {
  const total = items.length;
  if (!pageSize || pageSize <= 0) {
    return { items, total, page: 1, pageSize: total };
  }
  const p = Math.max(1, page);
  const start = (p - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page: p, pageSize };
}
