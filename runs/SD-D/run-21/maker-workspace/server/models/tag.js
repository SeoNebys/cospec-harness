import db from '../db/connection.js';

// Tag data-access (T031). Deleting a bookmark removes only bookmark_tag links,
// never tag rows (FR-018) — that is handled by the bookmark_tag cascade.

export function upsertTag(name) {
  const clean = String(name).trim();
  if (!clean) return null;
  db.prepare('INSERT OR IGNORE INTO tag (name) VALUES (?)').run(clean);
  return db.prepare('SELECT * FROM tag WHERE name = ? COLLATE NOCASE').get(clean);
}

export function setBookmarkTags(bookmarkId, tagNames) {
  const names = [...new Set((tagNames || []).map((t) => String(t).trim()).filter(Boolean))];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bookmark_tag WHERE bookmark_id = ?').run(bookmarkId);
    const link = db.prepare(
      'INSERT OR IGNORE INTO bookmark_tag (bookmark_id, tag_id) VALUES (?, ?)'
    );
    for (const name of names) {
      const tag = upsertTag(name);
      if (tag) link.run(bookmarkId, tag.id);
    }
  });
  tx();
}

export function getBookmarkTags(bookmarkId) {
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

export function listTagsWithCounts() {
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tag t
       LEFT JOIN bookmark_tag bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
}

export function suggestTags(prefix) {
  const p = `${String(prefix || '').trim()}%`;
  return db
    .prepare('SELECT name FROM tag WHERE name LIKE ? COLLATE NOCASE ORDER BY name COLLATE NOCASE LIMIT 10')
    .all(p)
    .map((r) => r.name);
}
