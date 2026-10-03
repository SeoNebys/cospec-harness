import { getDb } from '../db/index.js';
import { prep } from '../db/prep.js';

function keyOf(name) {
  return String(name).trim().toLowerCase();
}

// Find or create a tag by name, enforcing case-insensitive uniqueness
// (FR-012/013). Returns the tag row.
export function getOrCreateTag(name, db = getDb()) {
  const trimmed = String(name).trim();
  const nameKey = keyOf(trimmed);
  if (nameKey === '') return null;
  const existing = prep(db, 'SELECT * FROM tags WHERE name_key = ?').get(nameKey);
  if (existing) return existing;
  const info = prep(db, 'INSERT INTO tags (name, name_key) VALUES (?, ?)').run(
    trimmed,
    nameKey
  );
  return { id: info.lastInsertRowid, name: trimmed, name_key: nameKey };
}

// Set a bookmark's tags to exactly the provided list (used on create/edit).
export function setBookmarkTags(bookmarkId, tagNames, db = getDb()) {
  prep(db, 'DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  addBookmarkTags(bookmarkId, tagNames, db);
}

// Add tags to a bookmark, skipping any it already has (used by bulk + import).
export function addBookmarkTags(bookmarkId, tagNames, db = getDb()) {
  const link = prep(
    db,
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  const seen = new Set();
  for (const raw of tagNames || []) {
    const key = keyOf(raw);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    const tag = getOrCreateTag(raw, db);
    if (tag) link.run(bookmarkId, tag.id);
  }
}

export function removeBookmarkTags(bookmarkId, tagNames, db = getDb()) {
  for (const raw of tagNames || []) {
    const key = keyOf(raw);
    const tag = db.prepare('SELECT id FROM tags WHERE name_key = ?').get(key);
    if (tag) {
      db.prepare(
        'DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?'
      ).run(bookmarkId, tag.id);
    }
  }
}

export function tagsForBookmark(bookmarkId, db = getDb()) {
  return prep(
    db,
    `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
  )
    .all(bookmarkId)
    .map((r) => r.name);
}

// All tags with usage counts (FR "list tags").
export function listTags(db = getDb()) {
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
}

// Case-insensitive suggestions while typing (FR-012).
export function suggestTags(q, db = getDb()) {
  const needle = `%${keyOf(q)}%`;
  return db
    .prepare(
      `SELECT name FROM tags WHERE name_key LIKE ? ORDER BY name COLLATE NOCASE LIMIT 10`
    )
    .all(needle)
    .map((r) => r.name);
}
