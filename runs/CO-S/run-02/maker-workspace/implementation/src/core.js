/*
 * core.js — pure bookmark logic. No DOM, no storage, no network.
 * Works in Node (module.exports) and the browser (window.BM).
 *
 * Traceability: this module implements the behavioural rules of
 * SCN-001..SCN-009. See docs/scenario-code-map.md.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BM = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- URL helpers -----------------------------------------------------

  // Does the text plausibly look like a web link? (SCN-007: reject junk.)
  function looksLikeUrl(input) {
    if (typeof input !== 'string') return false;
    const s = input.trim();
    if (!s || /\s/.test(s)) return false; // links don't contain spaces
    if (/^https?:\/\//i.test(s)) return true;
    // bare domain like example.com/path — needs a dot + a TLD-ish suffix
    return /^[^\s.]+(\.[^\s.]+)+(\/|$|\?|#)/.test(s);
  }

  // Canonical form used to decide whether two links are "the same"
  // (SCN-007 duplicate detection): drop scheme, leading www., trailing slash.
  function normalizeUrl(input) {
    let s = String(input || '').trim();
    s = s.replace(/^https?:\/\//i, '');
    s = s.replace(/^www\./i, '');
    s = s.replace(/\/+$/, '');
    return s.toLowerCase();
  }

  // Ensure a stored URL has a scheme so it is followable from the list.
  function ensureScheme(input) {
    const s = String(input || '').trim();
    return /^https?:\/\//i.test(s) ? s : 'https://' + s;
  }

  // --- Tag helpers -----------------------------------------------------

  // Normalize a tag so near-duplicates collapse (SCN-005): trim, lowercase,
  // collapse internal whitespace to single spaces.
  function normalizeTag(tag) {
    return String(tag || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function normalizeTags(tags) {
    const out = [];
    (tags || []).forEach(function (t) {
      const n = normalizeTag(t);
      if (n && out.indexOf(n) === -1) out.push(n);
    });
    return out;
  }

  // --- Store -----------------------------------------------------------

  const ADD_INVALID = 'invalid';   // not a link (SCN-007)
  const ADD_DUPLICATE = 'duplicate'; // already saved (SCN-007)

  function BookmarkStore(items) {
    this.items = Array.isArray(items) ? items.slice() : [];
    this._seq = this.items.reduce(function (m, b) {
      return Math.max(m, Number(b.id) || 0);
    }, 0);
  }

  // Add a bookmark.
  // Returns { ok:true, bookmark } or
  //         { ok:false, reason:'invalid' } or
  //         { ok:false, reason:'duplicate', existing }.
  // `now` is injectable for deterministic tests.
  BookmarkStore.prototype.add = function (input, now) {
    const rawUrl = (input && input.url != null ? String(input.url) : '').trim();
    if (!looksLikeUrl(rawUrl)) {
      return { ok: false, reason: ADD_INVALID };
    }
    const existing = this.findByUrl(rawUrl);
    if (existing) {
      return { ok: false, reason: ADD_DUPLICATE, existing: existing };
    }
    const url = ensureScheme(rawUrl);
    const title = (input.title != null ? String(input.title) : '').trim();
    const bookmark = {
      id: ++this._seq,
      url: url,
      // Blank name falls back to the link itself (SCN-001).
      title: title,
      tags: normalizeTags(input.tags),
      savedAt: typeof now === 'number' ? now : Date.now()
    };
    this.items.push(bookmark);
    return { ok: true, bookmark: bookmark };
  };

  BookmarkStore.prototype.findByUrl = function (url) {
    const key = normalizeUrl(url);
    return this.items.find(function (b) { return normalizeUrl(b.url) === key; }) || null;
  };

  // The display name for a bookmark: its name, or the link if unnamed (SCN-001).
  function displayName(b) {
    return (b.title && b.title.trim()) ? b.title : b.url;
  }

  // Newest first (SCN-001).
  BookmarkStore.prototype.all = function () {
    return this.items.slice().sort(function (a, b) { return b.savedAt - a.savedAt; });
  };

  // Live search over name OR link address, case-insensitive (SCN-003).
  BookmarkStore.prototype.search = function (query) {
    const q = String(query || '').trim().toLowerCase();
    let list = this.all();
    if (!q) return list;
    return list.filter(function (b) {
      return displayName(b).toLowerCase().indexOf(q) !== -1 ||
             b.url.toLowerCase().indexOf(q) !== -1;
    });
  };

  // Bookmarks carrying a given tag, newest first (SCN-004).
  BookmarkStore.prototype.byTag = function (tag) {
    const t = normalizeTag(tag);
    return this.all().filter(function (b) { return b.tags.indexOf(t) !== -1; });
  };

  // All tags in use with counts, alphabetical (SCN-004).
  BookmarkStore.prototype.tagCounts = function () {
    const map = {};
    this.items.forEach(function (b) {
      b.tags.forEach(function (t) { map[t] = (map[t] || 0) + 1; });
    });
    return Object.keys(map).sort().map(function (t) {
      return { tag: t, count: map[t] };
    });
  };

  // Suggest existing tags for reuse given what the user is typing (SCN-005).
  // Returns { matches:[tag...], canCreate:bool, normalized:'...' }.
  BookmarkStore.prototype.suggestTags = function (prefix, chosen) {
    const q = normalizeTag(prefix);
    const taken = normalizeTags(chosen);
    const known = this.tagCounts().map(function (x) { return x.tag; })
      .filter(function (t) { return taken.indexOf(t) === -1; });
    if (!q) {
      return { matches: known.slice(0, 5), canCreate: false, normalized: '' };
    }
    const matches = known.filter(function (t) { return t.indexOf(q) !== -1; });
    const exists = this.tagCounts().some(function (x) { return x.tag === q; });
    return {
      matches: matches,
      canCreate: !exists && taken.indexOf(q) === -1,
      normalized: q
    };
  };

  return {
    looksLikeUrl: looksLikeUrl,
    normalizeUrl: normalizeUrl,
    ensureScheme: ensureScheme,
    normalizeTag: normalizeTag,
    normalizeTags: normalizeTags,
    displayName: displayName,
    BookmarkStore: BookmarkStore,
    ADD_INVALID: ADD_INVALID,
    ADD_DUPLICATE: ADD_DUPLICATE
  };
});
