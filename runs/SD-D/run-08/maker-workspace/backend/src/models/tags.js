import db, { stmt } from '../db/index.js';

/** Get an existing tag id by name (case-insensitive) or create it. */
export function getOrCreateTag(name) {
  const clean = String(name).trim();
  if (!clean) return null;
  const existing = stmt('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(clean);
  if (existing) return existing.id;
  const info = stmt('INSERT INTO tags (name) VALUES (?)').run(clean);
  return info.lastInsertRowid;
}

/** Replace the full tag set of a bookmark with the given names. */
export function setBookmarkTags(bookmarkId, names) {
  const unique = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
  const tx = db.transaction(() => {
    stmt('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    const link = stmt(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    );
    for (const name of unique) {
      const tagId = getOrCreateTag(name);
      if (tagId) link.run(bookmarkId, tagId);
    }
  });
  tx();
}

/** Add tags to a bookmark without removing existing ones (bulk addTags). */
export function addBookmarkTags(bookmarkId, names) {
  const link = stmt(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  const tx = db.transaction(() => {
    for (const name of names || []) {
      const clean = String(name).trim();
      if (!clean) continue;
      const tagId = getOrCreateTag(clean);
      if (tagId) link.run(bookmarkId, tagId);
    }
  });
  tx();
}

/** Remove tags from a bookmark (bulk removeTags). */
export function removeBookmarkTags(bookmarkId, names) {
  const del = stmt(
    `DELETE FROM bookmark_tags
     WHERE bookmark_id = ?
       AND tag_id IN (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)`
  );
  const tx = db.transaction(() => {
    for (const name of names || []) del.run(bookmarkId, String(name).trim());
  });
  tx();
}

export function getTagsForBookmark(bookmarkId) {
  return stmt(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

/** List tags, optionally filtered by prefix, with usage counts (FR-021). */
export function listTags(prefix) {
  const params = [];
  let where = '';
  if (prefix) {
    where = 'WHERE t.name LIKE ? COLLATE NOCASE';
    params.push(`${prefix}%`);
  }
  return stmt(
      `SELECT t.id, t.name, COUNT(bt.bookmark_id) AS count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       ${where}
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(...params);
}
