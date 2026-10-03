'use strict';
// Shared helpers used by the server (duplicate detection, PDF detection, tags).

// "Same address" rule (SCN-005): host is case-insensitive and www-insensitive,
// a trailing slash is ignored, but the PATH stays case-sensitive; query kept.
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const p = u.pathname.replace(/\/+$/, '');
    return host + p + u.search;
  } catch (e) {
    return String(url || '').trim().replace(/\/+$/, '');
  }
}

function isPdf(url, contentType) {
  if (contentType && /application\/pdf/i.test(contentType)) return true;
  return /\.pdf($|\?|#)/i.test(url || '');
}

// Reuse an existing tag when it matches case-insensitively (SCN-002).
function canonTag(tag, existingTags) {
  const hit = (existingTags || []).find(e => e.toLowerCase() === String(tag).toLowerCase());
  return hit || String(tag).trim();
}

// Collect all distinct tags across bookmarks.
function allTags(bookmarks) {
  const s = new Set();
  (bookmarks || []).forEach(b => (b.tags || []).forEach(t => s.add(t)));
  return [...s].sort((a, b) => a.localeCompare(b));
}

module.exports = { normalizeUrl, isPdf, canonTag, allTags };
