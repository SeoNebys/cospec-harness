'use strict';
// URL normalization for duplicate detection (SCN-006).
// Two links are "the same" when their normalized keys match. Normalization
// ignores: protocol (http/https), a leading "www.", host capitalization, a
// trailing slash, the #fragment, and a KNOWN list of tracking parameters.
// Any OTHER query parameter is kept, because it can genuinely change the page.

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_name', 'utm_reader', 'utm_social', 'utm_brand',
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'ref', 'ref_src', 'ref_url', 'referrer', 'yclid', '_hsenc', '_hsmi',
  'vero_id', 'oly_anon_id', 'oly_enc_id', 'spm', 'scm'
]);

function coerceUrl(raw) {
  if (raw == null) return null;
  let u = String(raw).trim();
  if (!u) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = 'https://' + u;
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

// Returns a stable string key for equality, or null if not a usable URL.
function normalizeKey(raw) {
  const url = coerceUrl(raw);
  if (!url) return null;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    // Non-web schemes: compare loosely on the whole thing, lowercased.
    return (url.protocol + '//' + url.host + url.pathname).toLowerCase();
  }
  const host = url.host.toLowerCase().replace(/^www\./, '');
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) params.delete(key);
  }
  const entries = [...params.entries()].sort((a, b) =>
    a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : (a[0] < b[0] ? -1 : 1)
  );
  const qs = entries.map(([k, v]) => `${k}=${v}`).join('&');
  let path = url.pathname.replace(/\/+$/, '');
  if (path === '') path = '';
  return host + path + (qs ? '?' + qs : '');
}

// A cleaned, canonical href to store as the bookmark's URL (keeps scheme,
// drops only tracking params and the fragment; keeps www as the user typed).
function canonicalHref(raw) {
  const url = coerceUrl(raw);
  if (!url) return null;
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) params.delete(key);
    }
    url.search = params.toString();
    url.hash = '';
  }
  return url.toString();
}

function siteOf(raw) {
  const url = coerceUrl(raw);
  if (!url) return '';
  return url.host.replace(/^www\./, '');
}

function looksLikePdf(raw) {
  const url = coerceUrl(raw);
  if (!url) return false;
  return /\.pdf($|\?)/i.test(url.pathname + url.search);
}

module.exports = { normalizeKey, canonicalHref, siteOf, looksLikePdf, coerceUrl, TRACKING_PARAMS };
