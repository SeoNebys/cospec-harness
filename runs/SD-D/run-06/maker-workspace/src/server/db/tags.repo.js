import { getDb } from './connection.js';

// Upsert a tag by name (case-insensitive merge, FR-031) and return its id.
export function upsertTag(name) {
  const db = getDb();
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  const existing = db
    .prepare('SELECT id FROM tag WHERE name = ? COLLATE NOCASE')
    .get(trimmed);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tag (name) VALUES (?)').run(trimmed);
  return info.lastInsertRowid;
}

// Replace a bookmark's tag set with the given names.
export function setBookmarkTags(bookmarkId, names) {
  const db = getDb();
  const cleaned = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    const link = db.prepare(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    );
    for (const name of cleaned) {
      const tagId = upsertTag(name);
      if (tagId) link.run(bookmarkId, tagId);
    }
  });
  tx();
}

// Add tags to a bookmark without removing existing ones (bulk addTags, FR-023).
export function addBookmarkTags(bookmarkId, names) {
  const db = getDb();
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  const tx = db.transaction(() => {
    for (const name of names || []) {
      const tagId = upsertTag(name);
      if (tagId) link.run(bookmarkId, tagId);
    }
  });
  tx();
}

// Remove tags from a bookmark by name (bulk removeTags, FR-023).
export function removeBookmarkTags(bookmarkId, names) {
  const db = getDb();
  const stmt = db.prepare(
    `DELETE FROM bookmark_tags
     WHERE bookmark_id = ?
       AND tag_id IN (SELECT id FROM tag WHERE name = ? COLLATE NOCASE)`
  );
  const tx = db.transaction(() => {
    for (const name of names || []) stmt.run(bookmarkId, String(name).trim());
  });
  tx();
}

export function getTagsForBookmark(bookmarkId) {
  return getDb()
    .prepare(
      `SELECT t.name FROM tag t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

// All tags with usage counts (FR-010 source).
export function listTags() {
  return getDb()
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tag t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
}

// Type-ahead suggestions matching a prefix/substring (FR-009).
export function suggestTags(q) {
  const query = String(q || '').trim();
  if (!query) return [];
  return getDb()
    .prepare(
      `SELECT name FROM tag WHERE name LIKE ? COLLATE NOCASE
       ORDER BY name COLLATE NOCASE LIMIT 10`
    )
    .all(`%${query}%`)
    .map((r) => r.name);
}
