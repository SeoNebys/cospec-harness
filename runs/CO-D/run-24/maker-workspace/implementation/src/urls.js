'use strict';
// URL helpers (SCN-001 duplicate equivalence, SCN-010 validity, SCN-014 PDF).

function withScheme(url) {
  const s = String(url || '').trim();
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

// Two addresses are the same bookmark when they differ only by a leading "www."
// or a trailing slash (SCN-001).
function normalizeKey(url) {
  const s = withScheme(url);
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    let pathname = u.pathname.replace(/\/+$/, '');
    return (host + pathname + u.search).toLowerCase();
  } catch (e) {
    return String(url || '').toLowerCase().replace(/\/+$/, '');
  }
}

// A clearly invalid entry (free text, no domain) is rejected; a bare domain is
// accepted (SCN-010).
function looksLikeUrl(url) {
  const s = withScheme(url);
  try {
    const u = new URL(s);
    if (u.hostname === 'localhost') return true;
    return /\./.test(u.hostname) && !/\s/.test(u.hostname);
  } catch (e) {
    return false;
  }
}

function isPdfUrl(url) {
  try {
    const u = new URL(withScheme(url));
    return /\.pdf$/i.test(u.pathname);
  } catch (e) {
    return /\.pdf($|[?#])/i.test(String(url || ''));
  }
}

module.exports = { withScheme, normalizeKey, looksLikeUrl, isPdfUrl };
