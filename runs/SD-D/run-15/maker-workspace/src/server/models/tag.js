// T021 [US3]: Tag data-access. Case-insensitive, trimmed, non-empty names.
import db from '../db/connection.js';

function clean(name) {
  return String(name ?? '').trim();
}

export function getOrCreate(name) {
  const n = clean(name);
  if (!n) return null;
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(n);
  return db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(n).id;
}

/** Existing tag names starting with prefix (suggestions, FR-012). */
export function listByPrefix(prefix = '', limit = 10) {
  const p = clean(prefix);
  if (!p) {
    return db
      .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE LIMIT ?')
      .all(limit)
      .map((r) => r.name);
  }
  return db
    .prepare(
      `SELECT name FROM tags WHERE name LIKE ? ESCAPE '\\' ORDER BY name COLLATE NOCASE LIMIT ?`
    )
    .all(p.replace(/[%_\\]/g, '\\$&') + '%', limit)
    .map((r) => r.name);
}

export function allNames() {
  return db.prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE').all().map((r) => r.name);
}

/** Replace a bookmark's tags with the given set (deduped, cleaned). */
export function setForBookmark(bookmarkId, names = []) {
  const unique = [];
  const seen = new Set();
  for (const raw of names) {
    const n = clean(raw);
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      unique.push(n);
    }
  }
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  for (const n of unique) link.run(bookmarkId, getOrCreate(n));
  pruneOrphans();
}

export function addToBookmark(bookmarkId, name) {
  const id = getOrCreate(name);
  if (id) db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)').run(bookmarkId, id);
}

export function removeFromBookmark(bookmarkId, name) {
  const n = clean(name);
  const row = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(n);
  if (row) db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?').run(bookmarkId, row.id);
  pruneOrphans();
}

export function pruneOrphans() {
  db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)'
  ).run();
}
