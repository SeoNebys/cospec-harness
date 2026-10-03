/*
 * URL normalization and duplicate-detection key.
 * Basis: SCN-001 (scheme added if omitted), SCN-008 & SCN-012 (dedupe rules).
 * UMD: usable from Node (require) and the browser (window.Normalize).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Normalize = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Accept a raw address; add https:// when no scheme is present. Return a URL or null.
  function normalizeUrl(raw) {
    let s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { return new URL(s); } catch (e) { return null; }
  }

  // Duplicate-detection key: scheme-insensitive, host lowercased with leading
  // "www." stripped, a single trailing slash on the path ignored, query kept.
  function dupKey(u) {
    let url;
    try { url = (typeof u === 'string') ? normalizeUrl(u) : u; } catch (e) { url = null; }
    if (!url) return String(u);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/,'');
    return host + path + (url.search || '');
  }

  // Prefer the secure address when comparing an existing vs. an incoming variant.
  function preferHttps(existingHref, incomingHref) {
    try {
      const a = new URL(existingHref), b = new URL(incomingHref);
      if (a.protocol === 'http:' && b.protocol === 'https:') return b.href;
    } catch (e) {}
    return existingHref;
  }

  return { normalizeUrl, dupKey, preferHttps };
});
