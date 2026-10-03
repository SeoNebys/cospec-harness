// Tag model: case-insensitive upsert, association, listing (data-model.md).
import db from '../db.js';

// Insert (or fetch) a tag by trimmed, case-insensitive name; returns its id.
export function upsertTag(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const existing = db.prepare('SELECT id FROM tags WHERE name_lower = ?').get(lower);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tags (name, name_lower) VALUES (?, ?)').run(trimmed, lower);
  return info.lastInsertRowid;
}

// Replace the full tag set on a bookmark with the given names.
export function setBookmarkTags(bookmarkId, names) {
  const list = Array.isArray(names) ? names : [];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    const seen = new Set();
    for (const raw of list) {
      const id = upsertTag(raw);
      if (id && !seen.has(id)) {
        seen.add(id);
        db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)').run(bookmarkId, id);
      }
    }
  });
  tx();
}

// All tag names on a bookmark, sorted.
export function tagsForBookmark(bookmarkId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

// All tags in use, sorted (for the filter control).
export function listTags() {
  return db
    .prepare(
      `SELECT DISTINCT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all()
    .map((r) => r.name);
}
