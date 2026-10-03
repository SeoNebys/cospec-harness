'use strict';

// Pure domain logic for bookmarks. No I/O here so it can be unit-tested and
// reused by the HTTP layer. Behaviour is derived from the approved scenarios
// SCN-001..SCN-008 (see context/scenarios).

/**
 * Normalise a raw user-entered link into a canonical URL string, or return
 * null when the text cannot be interpreted as a web address (SCN-005: invalid
 * input is rejected).
 */
function normaliseUrl(raw) {
  if (typeof raw !== 'string') return null;
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  let u;
  try {
    u = new URL(v);
  } catch (e) {
    return null;
  }
  // A usable web address must have a host with a dot or be localhost.
  if (!u.hostname || (u.hostname.indexOf('.') === -1 && u.hostname !== 'localhost')) {
    return null;
  }
  // Canonical form used for storage and duplicate detection.
  u.hash = '';
  return u.toString();
}

/** Normalise a tag: trimmed, lower-cased (SCN-002). Returns '' if empty. */
function normaliseTag(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

/**
 * Find an existing bookmark with the same canonical URL (SCN-006: duplicate
 * detection by same web address).
 */
function findDuplicate(bookmarks, url) {
  return bookmarks.find((b) => b.url === url) || null;
}

/** The friendly host label shown in the UI. */
function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

/**
 * Filter bookmarks for display given the current view, search text and tag
 * filter (SCN-003 search/tag filter, SCN-004 read-later views).
 * view: 'all' | 'unread' | 'read'
 */
function filterBookmarks(bookmarks, { view = 'all', search = '', tag = null } = {}) {
  const q = (search || '').trim().toLowerCase();
  const tagFilter = tag ? normaliseTag(tag) : null;
  return bookmarks.filter((b) => {
    if (view === 'unread' && !(b.readLater && !b.read)) return false;
    if (view === 'read' && !(b.readLater && b.read)) return false;
    if (tagFilter && !b.tags.includes(tagFilter)) return false;
    if (!q) return true;
    const hay = (b.title + ' ' + b.url + ' ' + b.tags.join(' ')).toLowerCase();
    return hay.indexOf(q) !== -1;
  });
}

/** Count of read-later bookmarks still unread (the "To read" badge, SCN-004). */
function unreadCount(bookmarks) {
  return bookmarks.filter((b) => b.readLater && !b.read).length;
}

/** All distinct tags in use, sorted — for the as-you-type suggestions (SCN-002). */
function allTags(bookmarks) {
  const set = new Set();
  bookmarks.forEach((b) => b.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

module.exports = {
  normaliseUrl,
  normaliseTag,
  findDuplicate,
  hostLabel,
  filterBookmarks,
  unreadCount,
  allTags,
};
