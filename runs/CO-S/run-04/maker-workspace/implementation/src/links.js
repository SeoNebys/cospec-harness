'use strict';

// Pure helpers for reasoning about links. No I/O here, so these are trivially
// unit-testable and shared between server logic and tests.

// SCN-007: heuristic for "does this look like a web link?"
// Deliberately loose: it must have a dot and contain no whitespace. This is a
// soft signal used only to decide whether to warn the user; it never blocks.
function looksLikeUrl(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/\s/.test(s)) return false;
  return /\./.test(s);
}

// Ensure a string can be parsed as a URL by giving it a scheme if missing.
function withScheme(text) {
  const s = String(text || '').trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s;
}

// SCN-008: normalise for duplicate detection. Ignores trivial differences —
// scheme, trailing slashes, and case — as agreed with the client.
function normalizeUrl(text) {
  const s = String(text || '').trim().toLowerCase();
  return s
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') // drop scheme
    .replace(/\/+$/, ''); // drop trailing slashes
}

function sameLink(a, b) {
  return normalizeUrl(a) === normalizeUrl(b);
}

// SCN-001/006: pull a human-readable name out of a page's HTML.
// Returns a cleaned title string, or null when there is no usable <title>.
function extractTitle(html) {
  if (typeof html !== 'string') return null;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const title = decodeBasicEntities(m[1]).replace(/\s+/g, ' ').trim();
  return title.length > 0 ? title : null;
}

function decodeBasicEntities(s) {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 10)); } catch (e) { return _; }
    });
}

// SCN-006: when no name can be found, the stand-in name is the address itself.
function fallbackName(url) {
  return String(url || '').trim();
}

module.exports = {
  looksLikeUrl,
  withScheme,
  normalizeUrl,
  sameLink,
  extractTitle,
  decodeBasicEntities,
  fallbackName,
};
