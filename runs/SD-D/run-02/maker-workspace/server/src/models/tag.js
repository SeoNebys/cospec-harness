// Tag model — shared identity by case-folded name_key (FR-008a).
// Reusing a name always resolves to the same single tag row.

export function foldTag(name) {
  return String(name).trim().toLowerCase();
}

export function resolveOrCreateTag(db, name) {
  const display = String(name).trim();
  const key = foldTag(display);
  if (key === '') return null;
  const existing = db.prepare('SELECT * FROM tag WHERE name_key = ?').get(key);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO tag (name, name_key) VALUES (?, ?)').run(display, key);
  return db.prepare('SELECT * FROM tag WHERE id = ?').get(info.lastInsertRowid);
}

// Replace the full tag set of a bookmark with the given list of names.
export function setBookmarkTags(db, bookmarkId, names) {
  const list = Array.isArray(names) ? names : [];
  db.prepare('DELETE FROM bookmark_tag WHERE bookmark_id = ?').run(bookmarkId);
  const seen = new Set();
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tag (bookmark_id, tag_id) VALUES (?, ?)'
  );
  for (const raw of list) {
    const key = foldTag(raw ?? '');
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    const tag = resolveOrCreateTag(db, raw);
    if (tag) link.run(bookmarkId, tag.id);
  }
  pruneOrphanTags(db);
}

export function addTagToBookmark(db, bookmarkId, name) {
  const tag = resolveOrCreateTag(db, name);
  if (!tag) return;
  db.prepare('INSERT OR IGNORE INTO bookmark_tag (bookmark_id, tag_id) VALUES (?, ?)').run(
    bookmarkId,
    tag.id
  );
}

export function removeTagFromBookmark(db, bookmarkId, name) {
  const key = foldTag(name);
  const tag = db.prepare('SELECT * FROM tag WHERE name_key = ?').get(key);
  if (!tag) return;
  db.prepare('DELETE FROM bookmark_tag WHERE bookmark_id = ? AND tag_id = ?').run(
    bookmarkId,
    tag.id
  );
  pruneOrphanTags(db);
}

export function getBookmarkTagNames(db, bookmarkId) {
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

export function listTags(db, prefix) {
  const rows = db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tag t
       LEFT JOIN bookmark_tag bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
  if (prefix) {
    const p = foldTag(prefix);
    return rows.filter((r) => foldTag(r.name).startsWith(p));
  }
  return rows;
}

// Remove tags no longer attached to any bookmark, so identities stay clean.
export function pruneOrphanTags(db) {
  db.prepare(
    'DELETE FROM tag WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tag)'
  ).run();
}
