// Search/browse logic for the bookmark list (SCN-003).
// Written to load both in the browser (attaches to window.BookmarkSearch) and
// under Node/CommonJS (module.exports) so it can be unit-tested directly.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BookmarkSearch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Case-insensitive "does this bookmark match the query", against name AND address.
  function matches(bookmark, query) {
    if (!query) return true;
    const q = String(query).toLowerCase();
    return String(bookmark.title).toLowerCase().includes(q) ||
           String(bookmark.url).toLowerCase().includes(q);
  }

  // HTML-escaped text with the first match wrapped in <mark> (empty query = no marks).
  function highlight(text, query) {
    const s = String(text);
    if (!query) return esc(s);
    const i = s.toLowerCase().indexOf(String(query).toLowerCase());
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + query.length)) + '</mark>' + esc(s.slice(i + query.length));
  }

  // The list to show and the count label for a given query (SCN-003).
  function summarize(bookmarks, query) {
    const total = bookmarks.length;
    const q = String(query || '').trim();
    if (!q) {
      return { shown: bookmarks.slice(), count: total, label: total === 1 ? '1 link saved' : total + ' links saved', noMatch: false };
    }
    const shown = bookmarks.filter((b) => matches(b, q));
    if (shown.length === 0) return { shown, count: 0, label: 'No matches', noMatch: true };
    return { shown, count: shown.length, label: shown.length + ' of ' + total + ' links', noMatch: false };
  }

  return { esc, matches, highlight, summarize };
});
