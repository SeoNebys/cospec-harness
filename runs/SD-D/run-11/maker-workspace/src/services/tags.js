// Tag assignment + suggestions (FR-009).
import db, { tx } from '../db/index.js';

/** Get-or-create a tag by name (case-insensitive), return its id. */
export function ensureTag(name) {
  const clean = String(name).trim();
  if (!clean) return null;
  const existing = db
    .prepare('SELECT id FROM tag WHERE name = ? COLLATE NOCASE')
    .get(clean);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tag (name) VALUES (?)').run(clean);
  return info.lastInsertRowid;
}

/** Replace a bookmark's full tag set (used for single-item edit). */
export function setBookmarkTags(bookmarkId, tagNames) {
  const names = [...new Set((tagNames || []).map((t) => String(t).trim()).filter(Boolean))];
  tx(() => {
    db.prepare('DELETE FROM bookmark_tag WHERE bookmark_id = ?').run(bookmarkId);
    for (const name of names) {
      const tagId = ensureTag(name);
      if (tagId) {
        db.prepare(
          'INSERT OR IGNORE INTO bookmark_tag (bookmark_id, tag_id) VALUES (?, ?)'
        ).run(bookmarkId, tagId);
      }
    }
  });
  cleanupOrphanTags();
}

/** Add tags to a bookmark without touching existing ones (bulk add, FR-019). */
export function addBookmarkTags(bookmarkId, tagNames) {
  const names = (tagNames || []).map((t) => String(t).trim()).filter(Boolean);
  tx(() => {
    for (const name of names) {
      const tagId = ensureTag(name);
      if (tagId) {
        db.prepare(
          'INSERT OR IGNORE INTO bookmark_tag (bookmark_id, tag_id) VALUES (?, ?)'
        ).run(bookmarkId, tagId);
      }
    }
  });
}

/** Remove specific tags from a bookmark, leaving others intact (bulk remove). */
export function removeBookmarkTags(bookmarkId, tagNames) {
  const names = (tagNames || []).map((t) => String(t).trim()).filter(Boolean);
  tx(() => {
    for (const name of names) {
      const tag = db
        .prepare('SELECT id FROM tag WHERE name = ? COLLATE NOCASE')
        .get(name);
      if (tag) {
        db.prepare(
          'DELETE FROM bookmark_tag WHERE bookmark_id = ? AND tag_id = ?'
        ).run(bookmarkId, tag.id);
      }
    }
  });
  cleanupOrphanTags();
}

/** Tags for one bookmark, as an array of names. */
export function tagsForBookmark(bookmarkId) {
  return db
    .prepare(
      `SELECT t.name FROM tag t
       JOIN bookmark_tag bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

/** All tags with usage counts, most-used first (suggestions). */
export function listWithCounts() {
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tag t
       LEFT JOIN bookmark_tag bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC, t.name COLLATE NOCASE`
    )
    .all();
}

/** Remove tags no longer attached to any bookmark. */
export function cleanupOrphanTags() {
  db.prepare(
    `DELETE FROM tag WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tag)`
  ).run();
}
