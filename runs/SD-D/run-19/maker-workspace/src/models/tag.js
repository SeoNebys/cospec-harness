import { getDb } from '../db/index.js';

/** Find or create a tag by name (case-insensitive), returning its id. */
export function upsertTag(name) {
  const db = getDb();
  const clean = String(name).trim();
  if (!clean) return null;
  const existing = db.prepare('SELECT id FROM tag WHERE name = ? COLLATE NOCASE').get(clean);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO tag (name) VALUES (?)').run(clean).lastInsertRowid;
}

/** Replace the full tag set of a bookmark. */
export function setBookmarkTags(bookmarkId, names = []) {
  const db = getDb();
  const unique = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    const insert = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
    for (const name of unique) insert.run(bookmarkId, upsertTag(name));
  });
  tx();
}

/** Add tags to a set of bookmarks (bulk). */
export function addTagsToBookmarks(bookmarkIds, names = []) {
  const db = getDb();
  const insert = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const name of names) {
      const tagId = upsertTag(name);
      if (tagId) for (const id of bookmarkIds) insert.run(id, tagId);
    }
  });
  tx();
}

/** Remove tags from a set of bookmarks (bulk). */
export function removeTagsFromBookmarks(bookmarkIds, names = []) {
  const db = getDb();
  const tx = db.transaction(() => {
    for (const name of names) {
      const tag = db.prepare('SELECT id FROM tag WHERE name = ? COLLATE NOCASE').get(String(name).trim());
      if (!tag) continue;
      const del = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?');
      for (const id of bookmarkIds) del.run(id, tag.id);
    }
  });
  tx();
}

export function tagsForBookmark(bookmarkId) {
  return getDb().prepare(
    'SELECT t.name FROM tag t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE'
  ).all(bookmarkId).map((r) => r.name);
}

/** List tags in use with counts, optionally filtered by a prefix (suggestions). */
export function listTags(prefix = '') {
  const db = getDb();
  const rows = prefix
    ? db.prepare(
        `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count FROM tag t
         LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE t.name LIKE ? ESCAPE '\\' COLLATE NOCASE
         GROUP BY t.id ORDER BY count DESC, t.name COLLATE NOCASE`
      ).all(`${String(prefix).replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    : db.prepare(
        `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count FROM tag t
         LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
         GROUP BY t.id ORDER BY count DESC, t.name COLLATE NOCASE`
      ).all();
  return rows;
}
