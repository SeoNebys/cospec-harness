// Shared resolver for a "view descriptor" used identically by the list endpoint
// and by bulk "apply to all matching" (FR-027, tasks T038a/T039). Given the full
// descriptor it returns the COMPLETE ordered result set (no pagination), honoring
// every facet: view scope, a clicked tag filter, saved-search include/exclude
// tags, and the search expression. This guarantees bulk actions affect exactly
// the bookmarks visible in the current view and nothing outside it.

import { parseQuery } from '../search/parser.js';
import { matches } from '../search/evaluate.js';
import { foldTag } from '../models/tag.js';

export const SORT_KEYS = new Set([
  'date_added_desc',
  'date_added_asc',
  'title_asc',
  'title_desc',
  'read_state',
]);

export function normalizeDescriptor(input = {}) {
  const view = ['normal', 'unread', 'archived'].includes(input.view) ? input.view : 'normal';
  const sort = SORT_KEYS.has(input.sort) ? input.sort : null; // null => caller default
  return {
    view,
    q: input.q ? String(input.q) : '',
    tag: input.tag ? String(input.tag) : '',
    includeTags: toArray(input.includeTags),
    excludeTags: toArray(input.excludeTags),
    sort,
  };
}

function toArray(v) {
  if (Array.isArray(v)) return v.map(String);
  if (v == null || v === '') return [];
  return [String(v)];
}

// Returns { rows, ast } — rows fully filtered + sorted (no pagination).
export function resolveView(db, descriptor, defaultSort = 'date_added_desc') {
  const d = normalizeDescriptor(descriptor);
  const ast = parseQuery(d.q); // throws SearchError on invalid expression

  // Scope via SQL.
  let sql = 'SELECT * FROM bookmark WHERE ';
  if (d.view === 'archived') {
    sql += 'archived = 1';
  } else if (d.view === 'unread') {
    sql += "archived = 0 AND read_state = 'unread'";
  } else {
    sql += 'archived = 0';
  }
  const rows = db.prepare(sql).all();

  // Attach tag names + folded keys for filtering and search.
  const tagStmt = db.prepare(
    `SELECT t.name AS name, t.name_key AS key
     FROM tag t JOIN bookmark_tag bt ON bt.tag_id = t.id
     WHERE bt.bookmark_id = ?`
  );
  const includeKeys = d.includeTags.map(foldTag).filter(Boolean);
  const excludeKeys = d.excludeTags.map(foldTag).filter(Boolean);
  const clickedKey = d.tag ? foldTag(d.tag) : null;

  const filtered = [];
  for (const r of rows) {
    const tagRows = tagStmt.all(r.id);
    const tagKeys = new Set(tagRows.map((tr) => tr.key));

    if (clickedKey && !tagKeys.has(clickedKey)) continue;
    if (includeKeys.length && !includeKeys.every((k) => tagKeys.has(k))) continue;
    if (excludeKeys.length && excludeKeys.some((k) => tagKeys.has(k))) continue;

    const candidate = {
      title: r.title,
      description: r.description,
      note_md: r.note_md,
      url: r.url,
      tagKeys,
    };
    if (!matches(ast, candidate)) continue;
    filtered.push(r);
  }

  sortRows(filtered, d.sort || defaultSort);
  return { rows: filtered, ast };
}

function sortRows(rows, sort) {
  const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  switch (sort) {
    case 'date_added_asc':
      rows.sort((a, b) => cmpStr(a.date_added, b.date_added));
      break;
    case 'title_asc':
      rows.sort((a, b) => cmpStr((a.title || '').toLowerCase(), (b.title || '').toLowerCase()));
      break;
    case 'title_desc':
      rows.sort((a, b) => cmpStr((b.title || '').toLowerCase(), (a.title || '').toLowerCase()));
      break;
    case 'read_state':
      // unread first, then by most-recent.
      rows.sort((a, b) => {
        if (a.read_state !== b.read_state) return a.read_state === 'unread' ? -1 : 1;
        return cmpStr(b.date_added, a.date_added);
      });
      break;
    case 'date_added_desc':
    default:
      rows.sort((a, b) => cmpStr(b.date_added, a.date_added));
      break;
  }
}
