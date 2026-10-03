// URL normalization and canonical identity for duplicate detection.
// Shared by the server (Node) and the browser. SCN-001, SCN-002, SCN-006.
(function (root) {
  'use strict';

  function normalizeUrl(raw) {
    var u = (raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      return new URL(u).toString();
    } catch (e) {
      return '';
    }
  }

  // Two addresses are "the same link" when they differ only by scheme, a leading
  // "www.", a trailing slash, or a URL fragment (SCN-002).
  function canonicalKey(url) {
    try {
      var p = new URL(url);
      var host = p.hostname.replace(/^www\./, '').toLowerCase();
      var path = p.pathname.replace(/\/+$/, '');
      if (path === '') path = '/';
      return host + path + p.search;
    } catch (e) {
      return url;
    }
  }

  var api = { normalizeUrl: normalizeUrl, canonicalKey: canonicalKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Canonical = api;
})(typeof self !== 'undefined' ? self : this);
