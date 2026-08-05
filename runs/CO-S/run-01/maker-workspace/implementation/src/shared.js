// Shared, pure bookmark logic used by BOTH the Node server and the browser UI.
// Loaded in Node via require(); loaded in the browser via <script> as window.BM.
// Keeping it in one place means search/validation/dedup behave identically on
// both sides and can be unit-tested directly (see test/shared.test.js).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BM = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // --- URL handling ------------------------------------------------------

  // Does the raw text look like a web link at all? (SCN-006: reject non-links.)
  function looksLikeUrl(raw) {
    if (!raw) return false;
    const s = String(raw).trim();
    if (/\s/.test(s) && !/^https?:\/\//i.test(s)) {
      // Multiple words with no scheme (e.g. "grocery list") is not a link.
      if (/\s/.test(s.replace(/^https?:\/\/\S*/i, ''))) return false;
    }
    return /^https?:\/\/\S+$/i.test(s) || /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(s);
  }

  // Add a scheme if missing, so "example.com" becomes "https://example.com".
  function normalizeUrl(raw) {
    let s = String(raw).trim();
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s;
  }

  // Canonical key for duplicate detection (SCN-006): same address regardless of
  // scheme, leading "www.", or a trailing slash.
  function canonicalUrl(raw) {
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    return s;
  }

  function hostOf(raw) {
    let s = String(raw).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    return s.split(/[/?#]/)[0];
  }

  // Fallback display name from the host, e.g. "nytimes.com" -> "Nytimes".
  function siteName(raw) {
    const host = hostOf(raw);
    const base = host.split('.')[0] || host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // --- Title extraction (server-side use) --------------------------------

  function decodeEntities(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0*39;|&apos;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  }

  // Pull the <title> out of an HTML document. Returns a trimmed string, or
  // null when there is no usable title (SCN-006 title-not-found).
  function extractTitle(html) {
    if (!html) return null;
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (!m) return null;
    const title = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    return title.length ? title : null;
  }

  // --- Search & tags -----------------------------------------------------

  // SCN-002: case-insensitive substring match against title OR site host.
  function matchesQuery(bookmark, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    const title = (bookmark.title || '').toLowerCase();
    const host = (bookmark.host || hostOf(bookmark.url || '')).toLowerCase();
    return title.includes(q) || host.includes(q);
  }

  // SCN-002 + SCN-003: apply the active tag filter and the text search together.
  function filterBookmarks(list, { query = '', tag = null } = {}) {
    return list.filter(function (b) {
      const tagOk = !tag || (Array.isArray(b.tags) && b.tags.includes(tag));
      return tagOk && matchesQuery(b, query);
    });
  }

  // SCN-003: the set of tags in use, with how many links carry each.
  function deriveTags(list) {
    const counts = new Map();
    list.forEach(function (b) {
      (b.tags || []).forEach(function (t) {
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort(function (a, b) { return a[0].localeCompare(b[0]); })
      .map(function (e) { return { tag: e[0], count: e[1] }; });
  }

  return {
    looksLikeUrl,
    normalizeUrl,
    canonicalUrl,
    hostOf,
    siteName,
    decodeEntities,
    extractTitle,
    matchesQuery,
    filterBookmarks,
    deriveTags
  };
});
