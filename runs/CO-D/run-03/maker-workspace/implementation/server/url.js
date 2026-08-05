'use strict';
// URL helpers shared by saving, dedup, and import.
// SCN-013 (reject non-links) and SCN-004 (duplicate detection tolerant of trivial differences).

// Return a normalized absolute URL string, or null if the input is obviously not a web address.
// Accepts input without a scheme (adds https://). Requires a dotted hostname and no spaces.
function looksLikeUrl(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.')) return null;
    return u.href;
  } catch {
    return null;
  }
}

// A comparison key that ignores trivial differences: scheme, "www.", trailing slash, case.
// Used so re-saving a near-identical link counts as the same one (SCN-004).
function normUrl(raw) {
  let s = String(raw || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/\/+$/, '');
  return s;
}

module.exports = { looksLikeUrl, normUrl };
