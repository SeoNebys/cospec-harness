import { getDb } from '../db/connection.js';
import { newId } from '../lib/ids.js';

// ---- Row mapping ---------------------------------------------------------

export function rowToBookmark(row) {
  if (!row) return null;
  const db = getDb();
  const tags = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tagId = t.id
       WHERE bt.bookmarkId = ? ORDER BY t.name COLLATE NOCASE`
    )
    .all(row.id)
    .map((r) => r.name);
  return {
    id: row.id,
    url: row.url,
    normalizedUrl: row.normalizedUrl,
    title: row.title,
    description: row.description,
    note: row.note,
    tags,
    faviconPath: row.faviconPath,
    previewImagePath: row.previewImagePath,
    read: !!row.read,
    archived: !!row.archived,
    snapshotType: row.snapshotType,
    snapshotPath: row.snapshotPath,
    snapshotStatus: row.snapshotStatus,
    webArchiveUrl: row.webArchiveUrl,
    metadataStatus: row.metadataStatus,
    dateAdded: row.dateAdded,
    dateUpdated: row.dateUpdated,
  };
}

// ---- Tags ----------------------------------------------------------------

export function upsertTag(name) {
  const db = getDb();
  const clean = String(name).trim().replace(/^#/, '');
  if (!clean) return null;
  const existing = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(clean);
  if (existing) return existing.id;
  const id = newId();
  db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, clean);
  return id;
}

export function setBookmarkTags(bookmarkId, tagNames) {
  const db = getDb();
  db.prepare('DELETE FROM bookmark_tags WHERE bookmarkId = ?').run(bookmarkId);
  const seen = new Set();
  for (const name of tagNames || []) {
    const clean = String(name).trim().replace(/^#/, '');
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    const tagId = upsertTag(clean);
    if (tagId) {
      db.prepare(
        'INSERT OR IGNORE INTO bookmark_tags (bookmarkId, tagId) VALUES (?, ?)'
      ).run(bookmarkId, tagId);
    }
  }
  pruneOrphanTags();
}

export function pruneOrphanTags() {
  const db = getDb();
  db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tagId FROM bookmark_tags)'
  ).run();
}

export function listTags(prefix) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmarkId) AS count
       FROM tags t LEFT JOIN bookmark_tags bt ON bt.tagId = t.id
       GROUP BY t.id ORDER BY count DESC, t.name COLLATE NOCASE`
    )
    .all();
  if (!prefix) return rows;
  const p = String(prefix).toLowerCase().replace(/^#/, '');
  return rows.filter((r) => r.name.toLowerCase().startsWith(p));
}

// ---- CRUD ----------------------------------------------------------------

export function getById(id) {
  const db = getDb();
  return rowToBookmark(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
}

export function getByNormalizedUrl(normalizedUrl) {
  const db = getDb();
  return rowToBookmark(
    db.prepare('SELECT * FROM bookmarks WHERE normalizedUrl = ?').get(normalizedUrl)
  );
}

export function insertBookmark(data) {
  const db = getDb();
  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO bookmarks
       (id, url, normalizedUrl, title, description, note, faviconPath, previewImagePath,
        read, archived, snapshotType, snapshotPath, snapshotStatus, webArchiveUrl,
        metadataStatus, dateAdded, dateUpdated)
     VALUES
       (@id, @url, @normalizedUrl, @title, @description, @note, @faviconPath, @previewImagePath,
        @read, @archived, @snapshotType, @snapshotPath, @snapshotStatus, @webArchiveUrl,
        @metadataStatus, @dateAdded, @dateUpdated)`
  ).run({
    id,
    url: data.url,
    normalizedUrl: data.normalizedUrl,
    title: data.title || '',
    description: data.description || '',
    note: data.note || '',
    faviconPath: data.faviconPath || null,
    previewImagePath: data.previewImagePath || null,
    read: data.read ? 1 : 0,
    archived: data.archived ? 1 : 0,
    snapshotType: data.snapshotType || 'none',
    snapshotPath: data.snapshotPath || null,
    snapshotStatus: data.snapshotStatus || 'pending',
    webArchiveUrl: data.webArchiveUrl || null,
    metadataStatus: data.metadataStatus || 'collected',
    dateAdded: data.dateAdded || now,
    dateUpdated: now,
  });
  if (data.tags && data.tags.length) setBookmarkTags(id, data.tags);
  return getById(id);
}

// Generic field updater. Only whitelisted columns; bumps dateUpdated unless told
// not to (background snapshot updates pass touch=false so they don't reorder).
const EDITABLE_COLUMNS = new Set([
  'url',
  'normalizedUrl',
  'title',
  'description',
  'note',
  'faviconPath',
  'previewImagePath',
  'read',
  'archived',
  'snapshotType',
  'snapshotPath',
  'snapshotStatus',
  'webArchiveUrl',
  'metadataStatus',
]);

export function updateBookmark(id, fields, { touch = true } = {}) {
  const db = getDb();
  const sets = [];
  const params = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!EDITABLE_COLUMNS.has(key)) continue;
    sets.push(`${key} = @${key}`);
    params[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  }
  if (touch) {
    sets.push('dateUpdated = @dateUpdated');
    params.dateUpdated = new Date().toISOString();
  }
  if (sets.length) {
    params.id = id;
    db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'tags')) {
    setBookmarkTags(id, fields.tags);
  }
  return getById(id);
}

export function deleteBookmark(id) {
  const db = getDb();
  const bm = getById(id);
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  pruneOrphanTags();
  return bm; // caller uses snapshotPath to remove the file
}

// All bookmarks for a view, as full objects (used for search evaluation).
export function listForView(view) {
  const db = getDb();
  let where;
  if (view === 'archived') where = 'archived = 1';
  else if (view === 'unread') where = 'archived = 0 AND read = 0';
  else where = 'archived = 0';
  const rows = db.prepare(`SELECT * FROM bookmarks WHERE ${where}`).all();
  return rows.map(rowToBookmark);
}

// Bookmarks whose snapshot is still pending (restart recovery, T057).
export function listPendingSnapshots() {
  const db = getDb();
  return db
    .prepare("SELECT * FROM bookmarks WHERE snapshotStatus = 'pending'")
    .all()
    .map(rowToBookmark);
}
