// Shared persistence helpers used across routes: bookmark serialization and
// tag management (upsert, replace, suggest, prune orphans).
import { db, transaction } from './db.js';

const getTagsStmt = db.prepare(`
  SELECT t.name FROM tags t
  JOIN bookmark_tags bt ON bt.tag_id = t.id
  WHERE bt.bookmark_id = ?
  ORDER BY t.name COLLATE NOCASE
`);

export function bookmarkTags(id) {
  return getTagsStmt.all(id).map((r) => r.name);
}

// Shape a DB row into the API representation (booleans + tags array).
export function serializeBookmark(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    normalized_url: row.normalized_url,
    title: row.title,
    description: row.description,
    notes_html: row.notes_html,
    favicon_url: row.favicon_url,
    preview_image_url: row.preview_image_url,
    is_read: !!row.is_read,
    is_archived: !!row.is_archived,
    saved_date: row.saved_date,
    updated_date: row.updated_date,
    offline_status: row.offline_status,
    offline_kind: row.offline_kind,
    offline_path: row.offline_path,
    ia_status: row.ia_status,
    ia_snapshot_url: row.ia_snapshot_url,
    tags: bookmarkTags(row.id),
  };
}

const getByIdStmt = db.prepare('SELECT * FROM bookmarks WHERE id = ?');
export function getBookmarkRow(id) {
  return getByIdStmt.get(id);
}
export function getBookmark(id) {
  return serializeBookmark(getByIdStmt.get(id));
}

const getByNormStmt = db.prepare('SELECT * FROM bookmarks WHERE normalized_url = ?');
export function findByNormalized(normalizedUrl) {
  return getByNormStmt.get(normalizedUrl);
}

const insertTagStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
const getTagIdStmt = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
const linkStmt = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
const unlinkAllStmt = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?');
const unlinkOneStmt = db.prepare(`
  DELETE FROM bookmark_tags
  WHERE bookmark_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)
`);

function ensureTagId(name) {
  insertTagStmt.run(name);
  return getTagIdStmt.get(name).id;
}

// Replace a bookmark's full tag set.
export const setTags = transaction((bookmarkId, names) => {
  unlinkAllStmt.run(bookmarkId);
  for (const raw of names || []) {
    const name = String(raw).trim();
    if (!name) continue;
    linkStmt.run(bookmarkId, ensureTagId(name));
  }
  pruneOrphanTags();
});

export const addTags = transaction((bookmarkId, names) => {
  for (const raw of names || []) {
    const name = String(raw).trim();
    if (!name) continue;
    linkStmt.run(bookmarkId, ensureTagId(name));
  }
});

export const removeTags = transaction((bookmarkId, names) => {
  for (const raw of names || []) {
    const name = String(raw).trim();
    if (!name) continue;
    unlinkOneStmt.run(bookmarkId, name);
  }
  pruneOrphanTags();
});

const pruneStmt = db.prepare(`
  DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)
`);
export function pruneOrphanTags() {
  pruneStmt.run();
}

const listTagsStmt = db.prepare(`
  SELECT t.id, t.name, COUNT(bt.bookmark_id) AS count
  FROM tags t
  LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
  GROUP BY t.id
  ORDER BY t.name COLLATE NOCASE
`);
export function listTags() {
  return listTagsStmt.all();
}

const suggestStmt = db.prepare(`
  SELECT name FROM tags WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE
  ORDER BY name COLLATE NOCASE LIMIT 10
`);
export function suggestTags(prefix) {
  const p = String(prefix || '').replace(/[\\%_]/g, (m) => '\\' + m);
  return suggestStmt.all(`${p}%`).map((r) => r.name);
}
