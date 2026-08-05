// Core spine logic — pure, no DOM/browser deps, so it is unit-testable in Node.
// Maps to SCN-001 (save/recognise/newest-on-top), SCN-003 (dedupe),
// SCN-004 (unreadable fallback title), SCN-022 (non-URL input).

// Turn whatever the client pasted into an openable URL (SCN-002).
export function toFullUrl(raw) {
  const s = String(raw || '').trim();
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

// Comparison key for duplicate detection: ignore protocol, "www.", a trailing
// slash, and case (SCN-003 approved rule).
export function normalizeUrl(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

export function hostOf(raw) {
  try {
    return new URL(toFullUrl(raw)).hostname.replace(/^www\./, '');
  } catch {
    return String(raw || '');
  }
}

// SCN-022: is this plausibly a web address (vs a stray thought / typo)?
export function isProbablyUrl(s) {
  s = String(s || '').trim();
  if (!s) return false;
  // Spaces without an explicit protocol => almost certainly not a URL.
  if (/\s/.test(s) && !/^https?:\/\//i.test(s)) return false;
  return /^https?:\/\/\S+\.\S+/i.test(s) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s);
}

// SCN-004 / recognisability fallback: derive a human-ish name from the URL
// itself when the real title can't be read.
export function deriveFallbackTitle(raw) {
  const key = normalizeUrl(raw);
  const host = (key.split('/')[0] || 'link').split('.')[0] || 'link';
  const slug = key.split('/').slice(1).join(' ').replace(/[-_]/g, ' ').trim();
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  return slug ? cap(slug).slice(0, 90) : cap(host);
}

// SCN-003: find an existing link with the same normalized address, or null.
export function findDuplicate(items, raw) {
  const n = normalizeUrl(raw);
  return items.find((it) => normalizeUrl(it.url) === n) || null;
}

// SCN-003 (edit back-door): when editing a link's address, catch a clash with a
// *different* existing link so editing can't create a twin either.
export function findDuplicateElsewhere(items, id, raw) {
  const n = normalizeUrl(raw);
  return items.find((it) => it.id !== id && normalizeUrl(it.url) === n) || null;
}

// SCN-001: newest saved link goes to the top of the list.
export function addToTop(items, item) {
  return [item, ...items];
}

// Shape a stored link record from a raw URL + (optional) fetched metadata.
// `savedAt` lets date-sorting reflect real history (SCN-014/015); caller passes
// the timestamp (kept out of here so the function stays pure/deterministic).
export function makeLink(raw, meta, savedAt) {
  const url = toFullUrl(raw);
  const ok = !!(meta && meta.ok && meta.title);
  return {
    url,
    norm: normalizeUrl(raw),
    title: ok ? meta.title : deriveFallbackTitle(raw),
    description: ok && meta.description ? meta.description : '',
    note: '', // SCN-007 personal note (HTML, light formatting per SCN-019)
    tags: [], // SCN-006 labels
    status: 'none', // SCN-010 read-later: 'none' | 'unread' | 'read'
    aside: false, // SCN-013 set-aside shelf
    unreadable: !ok, // SCN-004: saved anyway, flagged as name-not-read
    savedAt,
  };
}

// Read-later / shelf state accessors that tolerate older records missing fields.
export function statusOf(it) { return (it && it.status) || 'none'; }
export function isAside(it) { return !!(it && it.aside); }

// Some very common sites hide their title from a plain fetch but expose it via
// a public oEmbed endpoint (no login). Return that endpoint, or null. YouTube is
// the client's common everyday paste; the shape generalises to more providers.
export function oembedEndpoint(raw) {
  let u;
  try { u = new URL(toFullUrl(raw)); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  const yt = () => 'https://www.youtube.com/oembed?url=' + encodeURIComponent(u.href) + '&format=json';
  if (host === 'youtube.com' && u.pathname === '/watch' && u.searchParams.get('v')) return yt();
  if (host === 'youtu.be' && u.pathname.length > 1) return yt();
  return null;
}

// --- Labels (SCN-006) ---
export function normalizeTag(t) {
  return String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
export function addTag(tags, raw) {
  const t = normalizeTag(raw);
  if (!t) return tags;
  return tags.includes(t) ? tags : [...tags, t];
}
// Suggest existing labels as the client types, so near-duplicates aren't created.
export function suggestTags(allTags, query, chosen = []) {
  const q = normalizeTag(query);
  return allTags.filter((t) => !chosen.includes(t) && (!q || t.includes(q)));
}

// --- Personal note formatting (SCN-019): allow only bold + bulleted lists ---
export function sanitizeNote(html) {
  let s = String(html || '').replace(/<\/?(?:script|style)[^>]*>/gi, '');
  const allow = ['b', 'strong', 'ul', 'li', 'p', 'br'];
  s = s.replace(/<(\/?)([a-z0-9]+)[^>]*>/gi, (_m, slash, tag) =>
    allow.includes(tag.toLowerCase()) ? '<' + slash + tag.toLowerCase() + '>' : ''
  );
  return s.trim();
}
