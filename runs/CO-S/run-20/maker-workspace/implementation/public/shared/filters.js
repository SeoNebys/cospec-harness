// Pure, shared logic used by BOTH the browser client and the Node unit tests.
// No DOM, no I/O — just data transformations. Keep it dependency-free.
//
// Scenario basis:
//   SCN-002 search over title/description/note/address
//   SCN-003 topic membership filtering (several topics per link)
//   SCN-004 reading-status filtering (to read / read)
//   SCN-005 archive scope (archived vs main collection)
//   SCN-009 duplicate detection (case-insensitive, ignore trailing slash)

/** Normalise a URL for equality comparison only (not for storage/display). */
export function normalizeUrl(url) {
  return String(url == null ? '' : url).trim().toLowerCase().replace(/\/+$/, '');
}

/** Two addresses are "the same link" when their normalised forms match. */
export function sameUrl(a, b) {
  return normalizeUrl(a) === normalizeUrl(b);
}

/** The text a free-text search matches against (SCN-002). */
export function searchText(item) {
  return [item.title, item.description, item.note, item.url]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Does a link match the search query? Empty query matches everything. */
export function matchesQuery(item, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return searchText(item).includes(q);
}

/** Every distinct topic across the given links, sorted alphabetically (SCN-003). */
export function allTopics(items) {
  const set = new Set();
  for (const it of items) for (const t of it.topics || []) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Newest-saved first (SCN-001). */
export function byNewest(a, b) {
  return (b.created || 0) - (a.created || 0);
}

/**
 * Apply the active view to the full set of links.
 *   scope:   'collection' (default) or 'archive' (SCN-005)
 *   status:  'all' | 'unread' | 'read'  — only applies in the collection (SCN-004)
 *   topic:   'All' or a topic name (SCN-003)
 *   query:   free-text search (SCN-002)
 * Archived links never appear in the collection scope (and thus never in the
 * collection's search) and vice-versa.
 */
export function filterItems(items, { scope = 'collection', status = 'all', topic = 'All', query = '' } = {}) {
  const inArchive = scope === 'archive';
  let out = items.filter((it) => !!it.archived === inArchive);
  if (!inArchive) {
    if (status === 'unread') out = out.filter((it) => it.unread);
    else if (status === 'read') out = out.filter((it) => !it.unread);
  }
  if (topic && topic !== 'All') out = out.filter((it) => (it.topics || []).includes(topic));
  if (String(query || '').trim()) out = out.filter((it) => matchesQuery(it, query));
  return out.sort(byNewest);
}

/** Count of archived links, for the archive control (SCN-005). */
export function archivedCount(items) {
  return items.filter((it) => it.archived).length;
}
