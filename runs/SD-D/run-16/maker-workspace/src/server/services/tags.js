// Tag helpers shared across stories. Full suggestions/pruning belong to US3;
// the core get-or-create / linking used by save & search lives here.
import { getDb } from '../db/connection.js';

export function normalizeTag(name) {
  return String(name || '').trim();
}

export function getOrCreateTag(name) {
  const db = getDb();
  const clean = normalizeTag(name);
  if (!clean) return null;
  const existing = db.prepare('SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE').get(clean);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(clean);
  return Number(info.lastInsertRowid);
}

// Replace the full tag set for a bookmark.
export function setBookmarkTags(bookmarkId, tagNames = []) {
  const db = getDb();
  const unique = [...new Set((tagNames || []).map(normalizeTag).filter(Boolean).map((t) => t.toLowerCase()))]
    .map((low) => (tagNames.find((orig) => normalizeTag(orig).toLowerCase() === low)));
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  for (const name of unique) {
    const tagId = getOrCreateTag(name);
    if (tagId) link.run(bookmarkId, tagId);
  }
  pruneUnusedTags();
}

// Add tags to a bookmark without removing existing ones (bulk addTags).
export function addTagsToBookmark(bookmarkId, tagNames = []) {
  const db = getDb();
  const link = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  for (const name of tagNames.map(normalizeTag).filter(Boolean)) {
    const tagId = getOrCreateTag(name);
    if (tagId) link.run(bookmarkId, tagId);
  }
}

// Remove specific tags from a bookmark (bulk removeTags).
export function removeTagsFromBookmark(bookmarkId, tagNames = []) {
  const db = getDb();
  for (const name of tagNames.map(normalizeTag).filter(Boolean)) {
    const tag = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name);
    if (tag) db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?').run(bookmarkId, tag.id);
  }
  pruneUnusedTags();
}

export function getTagsForBookmark(bookmarkId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

// Remove tags no longer linked to any bookmark (keeps suggestions/filters clean).
export function pruneUnusedTags() {
  const db = getDb();
  db.prepare('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)').run();
}

export function listTags() {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       GROUP BY t.id ORDER BY t.name COLLATE NOCASE`
    )
    .all();
}

export function suggestTags(prefix) {
  const db = getDb();
  const p = normalizeTag(prefix);
  if (!p) return [];
  return db
    .prepare('SELECT name FROM tags WHERE name LIKE ? COLLATE NOCASE ORDER BY name COLLATE NOCASE LIMIT 10')
    .all(`${p}%`)
    .map((r) => r.name);
}
