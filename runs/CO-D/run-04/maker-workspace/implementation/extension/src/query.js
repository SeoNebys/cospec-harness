// Findability logic (SCN-008 topics, SCN-009 search, SCN-014 sort, SCN-021
// exclude). Pure functions over link records, so they are unit-testable.

// Plain text of a (possibly HTML) note, for searching (SCN-009 searches notes).
export function noteText(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

// SCN-009: quoted phrases stay whole; otherwise split into words. Lowercased.
export function parseTerms(q) {
  const out = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(q || '')) !== null) {
    const t = (m[1] || m[2]).toLowerCase().trim();
    if (t) out.push(t);
  }
  return out;
}

// Accent-fold so lazy typing finds accented links: "cafe" matches "café".
export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function haystack(link) {
  return fold([link.title, link.description, noteText(link.note), link.url].filter(Boolean).join(' '));
}

// SCN-009: a link matches when it contains ALL terms, anywhere, in any order.
export function matchesQuery(link, q) {
  const terms = parseTerms(q);
  if (!terms.length) return true;
  const hay = haystack(link);
  return terms.every((t) => hay.includes(fold(t)));
}

// SCN-009: which hidden places (note / address) a term hit, for the "Found in…" tag.
export function whereMatched(link, q) {
  const terms = parseTerms(q);
  if (!terms.length) return [];
  const note = fold(noteText(link.note));
  const url = fold(link.url || '');
  const w = [];
  if (terms.some((t) => note.includes(fold(t)))) w.push('your note');
  if (terms.some((t) => url.includes(fold(t)))) w.push('the web address');
  return w;
}

// SCN-008 / SCN-021: keep links that have all included topics and none excluded.
export function filterByTopics(links, includes = [], excludes = []) {
  return links.filter(
    (l) => includes.every((t) => (l.tags || []).includes(t)) && !excludes.some((t) => (l.tags || []).includes(t))
  );
}

// SCN-010/013: which links a lens shows. Set-aside links live ONLY on the shelf
// (excluded from Everything, the To-read pile, and everyday search).
export function poolForView(links, view) {
  if (view === 'aside') return links.filter((l) => l.aside);
  if (view === 'toread') return links.filter((l) => !l.aside && (l.status || 'none') === 'unread');
  return links.filter((l) => !l.aside); // 'all'
}

// SCN-020: a saved view's identity = lens + included + excluded topics + search
// text (NOT sort — sort is a separate standing preference). Used to detect the
// active saved view and to avoid offering "save" for one already saved.
export function savedViewKey(view, includes, excludes, q) {
  return [view, [...includes].sort().join(','), [...excludes].sort().join(','), String(q || '').trim().toLowerCase()].join('|');
}

export function unreadCount(links) { return links.filter((l) => !l.aside && (l.status || 'none') === 'unread').length; }
export function asideCount(links) { return links.filter((l) => l.aside).length; }

export function tagCounts(links) {
  const m = {};
  for (const l of links) for (const t of (l.tags || [])) m[t] = (m[t] || 0) + 1;
  return m;
}

// SCN-014: four named orders; date orders use savedAt (real history incl. import).
export function sortLinks(links, by) {
  const a = [...links];
  if (by === 'old') a.sort((x, y) => (x.savedAt || 0) - (y.savedAt || 0));
  else if (by === 'az') a.sort((x, y) => String(x.title).localeCompare(String(y.title)));
  else if (by === 'za') a.sort((x, y) => String(y.title).localeCompare(String(x.title)));
  else a.sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0)); // 'new' (default)
  return a;
}
