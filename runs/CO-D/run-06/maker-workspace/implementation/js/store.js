// store.js — data model + pure logic for the bookmarks app.
// DOM-free so it can be unit-tested directly. See context/scenario-code-map.md.

// ---------------------------------------------------------------------------
// URL handling  (SCN-007, SCN-014, SCN-016)
// ---------------------------------------------------------------------------

// Tracking params we strip when deciding "is this the same link?" (DD-3).
export const TRACKING_PARAMS = new Set([
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
  'gclid','fbclid','dclid','gbraid','wbraid','msclkid','mc_cid','mc_eid',
  'igshid','_hsenc','_hsmi','ref','ref_src','ref_','cmpid','spm','yclid','vero_id'
]);

// Add https:// if the user left the scheme off (SCN-014: lenient acceptance).
export function withScheme(raw) {
  const s = String(raw || '').trim();
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

// Is this plausibly a web address (vs. a plain sentence)? (SCN-014)
export function looksLikeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || /\s/.test(s)) return false;          // sentences have spaces
  try {
    const u = new URL(withScheme(s));
    return /\./.test(u.hostname) && u.hostname.length > 3;
  } catch (e) { return false; }
}

// Normalize for equality: drop protocol, leading www, trailing slash, lowercase host;
// strip tracking params but KEEP meaningful ones (SCN-007).
export function normalizeUrl(raw) {
  let u;
  try { u = new URL(withScheme(raw)); }
  catch (e) { return String(raw || '').trim().toLowerCase(); }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const path = u.pathname.replace(/\/+$/, '');
  const kept = [];
  u.searchParams.forEach((v, k) => {
    if (!TRACKING_PARAMS.has(k.toLowerCase())) kept.push([k.toLowerCase(), v]);
  });
  kept.sort((a, b) => a[0].localeCompare(b[0]));
  const qs = kept.map(([k, v]) => k + '=' + v).join('&');
  return host + path + (qs ? '?' + qs : '');
}

export function hostOf(raw) {
  try { return new URL(withScheme(raw)).hostname.replace(/^www\./, ''); }
  catch (e) { return ''; }
}

// ---------------------------------------------------------------------------
// Labels  (SCN-002)  — case-insensitive, first-spelling-wins
// ---------------------------------------------------------------------------

// Resolve typed text against an existing canonical list. Returns the existing
// canonical spelling if one matches case-insensitively, else the trimmed input.
export function canonicalLabel(input, existing) {
  const n = String(input || '').trim().toLowerCase();
  if (!n) return null;
  const hit = (existing || []).find(l => l.toLowerCase() === n);
  return { canonical: hit || String(input).trim(), isNew: !hit };
}

// ---------------------------------------------------------------------------
// Search + filter  (SCN-003, SCN-005, SCN-010, SCN-017)
// ---------------------------------------------------------------------------

// Full-text: every whitespace-separated term must appear somewhere in the
// bookmark's title, description, note, url, or labels.
// Text on the bookmark itself (everything a card already shows).
function surfaceText(b) {
  return [b.title, b.description, b.note, b.url, ...(b.labels || [])].filter(Boolean).join(' ');
}
// The saved copy's readable text (SCN-018) — part of search when a copy is kept.
function copyText(b) { return (b.copy && b.copy.status === 'kept' && b.copy.body) ? b.copy.body : ''; }

export function matchesQuery(b, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = (surfaceText(b) + ' ' + copyText(b)).toLowerCase();
  return q.split(/\s+/).filter(Boolean).every(t => hay.includes(t));
}

// "Why did this match?" — return a short snippet from the saved copy when a term
// matches ONLY inside the copy (not visible on the card). Null otherwise. (SCN-018)
export function copyMatchSnippet(b, query) {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return null;
  const surf = surfaceText(b).toLowerCase();
  const body = copyText(b);
  if (!body) return null;
  const low = body.toLowerCase();
  const term = terms.find(t => low.includes(t) && !surf.includes(t)); // only-in-copy term
  if (!term) return null;
  const i = low.indexOf(term);
  const start = Math.max(0, i - 40), end = Math.min(body.length, i + term.length + 40);
  return (start > 0 ? '…' : '') + body.slice(start, end).trim() + (end < body.length ? '…' : '');
}

// include (Set/array) + mode ('all'|'any') + exclude + query. Pure. (DD-7)
export function applyFilter(bookmarks, opts = {}) {
  const include = [...(opts.include || [])];
  const exclude = [...(opts.exclude || [])];
  const mode = opts.mode === 'any' ? 'any' : 'all';
  const q = opts.query || '';
  return bookmarks.filter(b => {
    const labels = b.labels || [];
    for (const l of exclude) if (labels.includes(l)) return false;
    if (include.length) {
      if (mode === 'all') { for (const l of include) if (!labels.includes(l)) return false; }
      else if (!include.some(l => labels.includes(l))) return false;
    }
    return matchesQuery(b, q);
  });
}

export function sortBookmarks(list, mode) {
  const s = [...list];
  if (mode === 'old') s.sort((a, b) => a.savedAt - b.savedAt);
  else if (mode === 'az') s.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  else s.sort((a, b) => b.savedAt - a.savedAt); // 'new' (default)
  return s;
}

// A bookmark always has a usable name: its title, or the address (SCN-014).
export function displayName(b) {
  return (b.title && b.title.trim()) || hostOf(b.url) || b.url;
}

export function findByUrl(bookmarks, raw) {
  const key = normalizeUrl(raw);
  return bookmarks.find(b => normalizeUrl(b.url) === key) || null;
}

// ---------------------------------------------------------------------------
// Store  — owns state + persistence (localStorage; DD-1)
// ---------------------------------------------------------------------------

const KEY = 'bookmarks.v1';
let _seq = 1;
function newId() { return 'b' + Date.now().toString(36) + '_' + (_seq++).toString(36); }

export class Store {
  constructor(storage) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.bookmarks = [];
    this.labels = []; // canonical registry, first-spelling-wins
    this.views = []; // saved views (SCN-017): {name, include[], exclude[], mode, query}
    this.load();
  }

  load() {
    try {
      const raw = this.storage && this.storage.getItem(KEY);
      if (raw) { const data = JSON.parse(raw); this.bookmarks = data.bookmarks || []; this.labels = data.labels || []; this.views = data.views || []; }
    } catch (e) { /* start empty */ }
  }
  save() {
    try { this.storage && this.storage.setItem(KEY, JSON.stringify({ bookmarks: this.bookmarks, labels: this.labels, views: this.views })); }
    catch (e) { /* ignore quota errors in prototype */ }
  }

  // Saved views (SCN-017): store the whole filter — labels, mode, exclude, AND query.
  addView(name, { include = [], exclude = [], mode = 'all', query = '' } = {}) {
    const nm = String(name || '').trim(); if (!nm) return null;
    const view = { name: nm, include: [...include], exclude: [...exclude], mode, query: String(query || '').trim() };
    const i = this.views.findIndex(v => v.name.toLowerCase() === nm.toLowerCase());
    if (i >= 0) this.views[i] = view; else this.views.push(view);   // name is unique; re-saving updates
    this.save();
    return view;
  }
  removeView(name) {
    const low = String(name).toLowerCase();
    this.views = this.views.filter(v => v.name.toLowerCase() !== low);
    this.save();
  }

  // Register a label (canonical spelling wins) and return the canonical form.
  ensureLabel(input) {
    const r = canonicalLabel(input, this.labels);
    if (!r) return null;
    if (r.isNew) this.labels.push(r.canonical);
    return r.canonical;
  }
  // Canonicalize a list of label inputs and dedupe within it (SCN-002: no twins).
  resolveLabels(list) {
    const seen = new Set(), out = [];
    for (const l of (list || [])) { const c = this.ensureLabel(l); if (c && !seen.has(c)) { seen.add(c); out.push(c); } }
    return out;
  }
  labelCounts() {
    const c = {};
    for (const b of this.bookmarks) if (!b.archived) for (const l of (b.labels || [])) c[l] = (c[l] || 0) + 1;
    return c;
  }

  addBookmark({ url, title = '', description = '', note = '', labels = [], unread = true, savedAt = null, favicon = null, thumbnail = null, copy = null }) {
    const b = {
      id: newId(),
      url: normalizeUrl(url),
      title, description, note,
      labels: this.resolveLabels(labels),
      unread, archived: false,
      savedAt: savedAt || Date.now(),
      favicon, thumbnail,
      copy: copy || { status: 'pending' }   // SCN-018: filled by background capture
    };
    this.bookmarks.unshift(b);
    this.save();
    return b;
  }

  // Record the outcome of a background page capture (SCN-018).
  setCopy(id, copy) {
    const b = this.bookmarks.find(x => x.id === id);
    if (!b) return null;
    b.copy = copy;   // { status:'kept', body, images } | { status:'none' }
    this.save();
    return b;
  }

  updateBookmark(id, patch) {
    const b = this.bookmarks.find(x => x.id === id);
    if (!b) return null;
    if (patch.labels) patch.labels = this.resolveLabels(patch.labels);
    Object.assign(b, patch);
    this.save();
    return b;
  }

  // Delete returns an undo closure (SCN-008, SCN-012).
  deleteBookmarks(ids) {
    const set = new Set(ids);
    const removed = this.bookmarks
      .map((b, i) => ({ b, i }))
      .filter(x => set.has(x.b.id));
    this.bookmarks = this.bookmarks.filter(b => !set.has(b.id));
    this.save();
    return () => { // undo: reinsert at original positions
      removed.sort((a, z) => a.i - z.i).forEach(({ b, i }) => this.bookmarks.splice(i, 0, b));
      this.save();
    };
  }

  setFlag(ids, key, value) {
    const set = new Set(ids);
    const prev = [];
    for (const b of this.bookmarks) if (set.has(b.id)) { prev.push([b.id, b[key]]); b[key] = value; }
    this.save();
    return () => { const m = new Map(prev); for (const b of this.bookmarks) if (m.has(b.id)) b[key] = m.get(b.id); this.save(); };
  }
  setAside(ids)  { return this.setFlag(ids, 'archived', true); }
  putBack(ids)   { return this.setFlag(ids, 'archived', false); }
  markRead(ids)  { return this.setFlag(ids, 'unread', false); }
  markToRead(ids){ return this.setFlag(ids, 'unread', true); }

  addLabelTo(ids, label) {
    const canon = this.ensureLabel(label); const set = new Set(ids); const changed = [];
    if (!canon) return () => {};
    for (const b of this.bookmarks) if (set.has(b.id) && !b.labels.includes(canon)) { b.labels.push(canon); changed.push(b.id); }
    this.save();
    return () => { const s = new Set(changed); for (const b of this.bookmarks) if (s.has(b.id)) b.labels = b.labels.filter(l => l !== canon); this.save(); };
  }
  removeLabelFrom(ids, label) {
    const set = new Set(ids); const changed = []; const low = String(label).toLowerCase();
    for (const b of this.bookmarks) if (set.has(b.id) && b.labels.some(l => l.toLowerCase() === low)) {
      changed.push(b.id); b.labels = b.labels.filter(l => l.toLowerCase() !== low);
    }
    this.save();
    return () => { const s = new Set(changed); for (const b of this.bookmarks) if (s.has(b.id)) b.labels.push(label); this.save(); };
  }
  labelsPresentIn(ids) {
    const set = new Set(ids); const out = new Set();
    for (const b of this.bookmarks) if (set.has(b.id)) for (const l of b.labels) out.add(l);
    return [...out];
  }

  // Import (SCN-016): entries = [{url,title,folder,addedAt}]. Skips duplicates.
  importBookmarks(entries, { foldersAsLabels = true, readMode = 'handled' } = {}) {
    let imported = 0, skipped = 0; const createdLabels = new Set();
    for (const e of entries) {
      if (!looksLikeUrl(e.url)) { skipped++; continue; }
      if (findByUrl(this.bookmarks, e.url)) { skipped++; continue; } // dedupe (SCN-007)
      const folder = e.folder || '';
      const isReadLater = /read[\s_-]?later|to[\s_-]?read/i.test(folder);
      const unread = readMode === 'toread' ? true : isReadLater; // default handled, except Read-Later
      const labels = [];
      if (foldersAsLabels && folder) { const c = this.ensureLabel(folder); if (c) { labels.push(c); createdLabels.add(c); } }
      this.bookmarks.push({
        id: newId(), url: normalizeUrl(e.url),
        title: e.title || '', description: '', note: '',
        labels, unread, archived: false,
        savedAt: e.addedAt || Date.now(),   // preserve original date when present
        favicon: null, thumbnail: null,
        copy: { status: 'pending' }         // captured lazily after import (SCN-018)
      });
      imported++;
    }
    this.save();
    return { imported, skipped, labelsCreated: createdLabels.size };
  }
}
