// Bookmark model / data access.
import db from '../db/index.js';
import { getTagsForBookmark, setBookmarkTags } from './tag.js';

function nowIso() { return new Date().toISOString(); }

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    is_read: !!row.is_read,
    is_archived: !!row.is_archived,
    tags: getTagsForBookmark(row.id),
  };
}

export function getById(id) {
  return hydrate(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
}

export function getByUrl(url) {
  return hydrate(db.prepare('SELECT * FROM bookmarks WHERE url = ?').get(url));
}

export function create({ url, title, description, note, icon_url, preview_image_url, tags }) {
  const ts = nowIso();
  const info = db.prepare(
    `INSERT INTO bookmarks
      (url, title, description, note, icon_url, preview_image_url, is_read, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
  ).run(
    url,
    title || url,               // fall back to URL when no title (FR-005)
    description || null,
    note || null,
    icon_url || null,
    preview_image_url || null,
    ts, ts
  );
  const id = info.lastInsertRowid;
  if (tags && tags.length) setBookmarkTags(id, tags);
  return getById(id);
}

const UPDATABLE = ['title', 'description', 'note', 'url', 'icon_url', 'preview_image_url'];

export function update(id, fields) {
  const sets = [];
  const vals = [];
  for (const key of UPDATABLE) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${key} = ?`);
      vals.push(fields[key]);
    }
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    vals.push(nowIso());
    vals.push(id);
    db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'tags')) {
    setBookmarkTags(id, fields.tags || []);
    db.prepare('UPDATE bookmarks SET updated_at = ? WHERE id = ?').run(nowIso(), id);
  }
  return getById(id);
}

export function setReadState(id, isRead) {
  db.prepare('UPDATE bookmarks SET is_read = ?, updated_at = ? WHERE id = ?')
    .run(isRead ? 1 : 0, nowIso(), id);
  return getById(id);
}

export function setArchivedState(id, isArchived) {
  db.prepare('UPDATE bookmarks SET is_archived = ?, updated_at = ? WHERE id = ?')
    .run(isArchived ? 1 : 0, nowIso(), id);
  return getById(id);
}

export function setPageCopy(id, filePath, kind) {
  db.prepare('UPDATE bookmarks SET page_copy_path = ?, page_copy_kind = ?, updated_at = ? WHERE id = ?')
    .run(filePath, kind, nowIso(), id);
  return getById(id);
}

export function setArchiveOrgUrl(id, url) {
  db.prepare('UPDATE bookmarks SET archive_org_url = ?, updated_at = ? WHERE id = ?')
    .run(url, nowIso(), id);
  return getById(id);
}

export function remove(id) {
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
}

// Return all bookmarks for a given view (before text/tag filtering).
export function allForView(view) {
  let where = 'is_archived = 0';
  if (view === 'archive') where = 'is_archived = 1';
  else if (view === 'unread') where = 'is_archived = 0 AND is_read = 0';
  const rows = db.prepare(`SELECT * FROM bookmarks WHERE ${where}`).all();
  return rows.map(hydrate);
}

export function sortBookmarks(list, sort) {
  const arr = [...list];
  switch (sort) {
    case 'oldest': arr.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
    case 'title': arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })); break;
    case 'updated': arr.sort((a, b) => b.updated_at.localeCompare(a.updated_at)); break;
    case 'newest':
    default: arr.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
  }
  return arr;
}

export function allBookmarksForExport() {
  const rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at').all();
  return rows.map(hydrate);
}
