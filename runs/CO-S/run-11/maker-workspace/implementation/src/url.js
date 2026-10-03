'use strict';

// URL helpers shared by save/edit and duplicate detection.
// Behaviour basis: SCN-001 (valid link), SCN-006 (sameness rule), SCN-009 (validation).

/**
 * A link is valid only if it parses and uses http/https.
 */
function isValidUrl(raw) {
  if (typeof raw !== 'string') return false;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  return u.protocol === 'http:' || u.protocol === 'https:';
}

/**
 * Canonical key used to decide whether two links are "the same" (SCN-006):
 *   - lowercase the domain only
 *   - ignore a single trailing "/" on the path
 *   - keep the path and query string case-sensitive (later capitalisation can
 *     identify a genuinely different page)
 * Returns null when the input is not a valid URL.
 */
function normalizeUrl(raw) {
  if (!isValidUrl(raw)) return null;
  const u = new URL(raw.trim());
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/$/, '');
  return host + path + u.search;
}

module.exports = { isValidUrl, normalizeUrl };
