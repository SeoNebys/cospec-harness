/*
 * Bookmarks — core logic (pure, no DOM).
 * Runs in the browser (window.BookmarksCore) and in Node (module.exports) so the
 * same logic is used by the app and by the acceptance tests.
 *
 * Scenario coverage: see context/scenario-code-map.md
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BookmarksCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- URLs -----------------------------------------------------------------

  function ensureScheme(raw) {
    const s = String(raw).trim();
    return /^https?:\/\//i.test(s) ? s : 'https://' + s;
  }

  // SCN-009: a "plausible web link" parses as a URL with a dotted hostname.
  function looksLikeLink(raw) {
    const s = String(raw).trim();
    if (!s) return false;
    let u;
    try { u = new URL(ensureScheme(s)); } catch (e) { return false; }
    return /^[^\s.]+(\.[^\s.]+)+$/.test(u.hostname);
  }

  function fullUrl(raw) { return new URL(ensureScheme(raw)).href; }

  // SCN-010: canonical key for duplicate detection. Case-insensitive; ignores
  // scheme, a leading "www.", and a trailing slash.
  function normalizeUrl(raw) {
    if (!looksLikeLink(raw)) return null;
    const u = new URL(ensureScheme(raw));
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    return (host + path + (u.search || '')).toLowerCase();
  }

  // --- Titles (SCN-001) -----------------------------------------------------
  // Client-only app: derive a readable title from the URL rather than fetching
  // the remote page (which browsers block cross-origin). See design decision D2.
  function prettifySegment(seg) {
    try { seg = decodeURIComponent(seg); } catch (e) { /* keep raw */ }
    seg = seg.replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_]+/g, ' ').trim();
    return seg.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function deriveTitle(raw) {
    let u;
    try { u = new URL(ensureScheme(raw)); } catch (e) { return String(raw); }
    const host = u.hostname.replace(/^www\./, '');
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length) {
      const last = prettifySegment(segs[segs.length - 1]);
      if (last) return last + ' — ' + host;
    }
    return host;
  }

  // --- Groups (SCN-002, SCN-007, SCN-012) -----------------------------------

  // SCN-012: reuse an existing spelling when names match case-insensitively.
  function canonicalGroup(name, pool) {
    const n = String(name).trim();
    if (!n) return '';
    const hit = (pool || []).find(function (g) { return g.toLowerCase() === n.toLowerCase(); });
    return hit || n;
  }

  // SCN-007: groups are just the labels currently in use, first-seen order.
  function usedGroups(items) {
    const seen = [];
    const lc = new Set();
    items.forEach(function (it) {
      it.groups.forEach(function (g) {
        if (!lc.has(g.toLowerCase())) { lc.add(g.toLowerCase()); seen.push(g); }
      });
    });
    return seen;
  }

  // Normalize a raw list of group names: trim, canonicalize casing, de-duplicate.
  function normalizeGroups(rawGroups, existing) {
    const out = [];
    const pool = (existing || []).slice();
    (rawGroups || []).forEach(function (r) {
      const c = canonicalGroup(r, pool.concat(out));
      if (c && !out.some(function (g) { return g.toLowerCase() === c.toLowerCase(); })) out.push(c);
    });
    return out;
  }

  // --- Bookmarks ------------------------------------------------------------

  function findDuplicate(items, raw) {
    const key = normalizeUrl(raw);
    if (!key) return null;
    return items.find(function (it) { return it.normKey === key; }) || null;
  }

  function makeBookmark(raw, groups, id) {
    return {
      id: id,
      url: fullUrl(raw),
      normKey: normalizeUrl(raw),
      title: deriveTitle(raw),
      groups: normalizeGroups(groups || [], [])
    };
  }

  // Decide whether a save is allowed. Returns:
  //   {ok:true} | {ok:false, error:'empty'|'invalid'|'duplicate', duplicate?}
  function validateAdd(items, raw) {
    if (!String(raw).trim()) return { ok: false, error: 'empty' };          // SCN-009
    if (!looksLikeLink(raw)) return { ok: false, error: 'invalid' };        // SCN-009
    const dup = findDuplicate(items, raw);
    if (dup) return { ok: false, error: 'duplicate', duplicate: dup };      // SCN-010
    return { ok: true };
  }

  // --- Finding (SCN-003, SCN-004) -------------------------------------------

  // SCN-004: match title, url, or group name; case-insensitive; spans all items.
  function search(items, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items.slice();
    return items.filter(function (it) {
      return it.title.toLowerCase().indexOf(q) !== -1 ||
             it.url.toLowerCase().indexOf(q) !== -1 ||
             it.groups.some(function (g) { return g.toLowerCase().indexOf(q) !== -1; });
    });
  }

  // SCN-003: links belonging to a group (multi-group aware).
  function inGroup(items, group) {
    if (!group || group === 'All') return items.slice();
    return items.filter(function (it) {
      return it.groups.some(function (g) { return g.toLowerCase() === group.toLowerCase(); });
    });
  }

  return {
    ensureScheme: ensureScheme,
    looksLikeLink: looksLikeLink,
    fullUrl: fullUrl,
    normalizeUrl: normalizeUrl,
    deriveTitle: deriveTitle,
    canonicalGroup: canonicalGroup,
    usedGroups: usedGroups,
    normalizeGroups: normalizeGroups,
    findDuplicate: findDuplicate,
    makeBookmark: makeBookmark,
    validateAdd: validateAdd,
    search: search,
    inGroup: inGroup
  };
});
