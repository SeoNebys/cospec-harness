// Tag model + bookmark_tags linking. Case-insensitive uniqueness (FR-014a).
import db from '../db/index.js';

export function getOrCreateTag(name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const existing = db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(clean);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(clean);
  return { id: info.lastInsertRowid, name: clean };
}

export function setBookmarkTags(bookmarkId, names) {
  const list = Array.from(new Set((names || []).map((n) => String(n).trim()).filter(Boolean)));
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  for (const name of list) {
    const tag = getOrCreateTag(name);
    if (tag) link.run(bookmarkId, tag.id);
  }
}

export function addTagsToBookmark(bookmarkId, names) {
  const link = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  for (const name of names || []) {
    const tag = getOrCreateTag(name);
    if (tag) link.run(bookmarkId, tag.id);
  }
}

export function removeTagsFromBookmark(bookmarkId, names) {
  for (const name of names || []) {
    const tag = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(String(name).trim());
    if (tag) db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?').run(bookmarkId, tag.id);
  }
}

export function getTagsForBookmark(bookmarkId) {
  return db.prepare(
    `SELECT t.name FROM tags t
     JOIN bookmark_tags bt ON bt.tag_id = t.id
     WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE`
  ).all(bookmarkId).map((r) => r.name);
}

export function listTags(prefix) {
  if (prefix) {
    return db.prepare(
      'SELECT name FROM tags WHERE name LIKE ? COLLATE NOCASE ORDER BY name COLLATE NOCASE'
    ).all(prefix + '%').map((r) => r.name);
  }
  return db.prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE').all().map((r) => r.name);
}

// Remove tags no longer referenced by any bookmark (housekeeping).
export function pruneOrphanTags() {
  db.prepare('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)').run();
}
