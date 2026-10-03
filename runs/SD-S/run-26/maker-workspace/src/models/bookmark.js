// Bookmark model: CRUD, list/search/sort/filter, status, archive, duplicate lookup.
import fs from 'node:fs';
import db from '../db.js';
import { normalizeUrl, titleFromUrl } from '../util/url.js';
import { setBookmarkTags, tagsForBookmark } from './tag.js';

function nowIso() {
  return new Date().toISOString();
}

// Shape a DB row + its tags into the API bookmark object.
export function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    address: row.address,
    title: row.title,
    description: row.description || '',
    faviconUrl: row.favicon_path ? `/assets/favicons/${row.favicon_path}` : null,
    previewImageUrl: row.preview_image_path ? `/assets/thumbnails/${row.preview_image_path}` : null,
    notes: row.notes || '',
    status: row.status,
    archived: !!row.archived,
    snapshotAvailable: !!row.snapshot_available,
    snapshotType: row.snapshot_type || null,
    snapshotUrl: row.snapshot_available ? `/api/bookmarks/${row.id}/snapshot` : null,
    tags: tagsForBookmark(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Find a bookmark by normalized address across active AND archived (FR-018).
export function findByNormalized(address) {
  const key = normalizeUrl(address);
  return db.prepare('SELECT * FROM bookmarks WHERE normalized_url = ?').get(key);
}

export function getRaw(id) {
  return db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
}

export function get(id) {
  return serialize(getRaw(id));
}

// Create a new bookmark. `details` carries fetched/derived metadata + snapshot info.
export function create({ address, title, description, notes, tags }, details = {}) {
  const ts = nowIso();
  const normalized = normalizeUrl(address);
  const finalTitle =
    (title && title.trim()) || (details.title && details.title.trim()) || titleFromUrl(address);
  const finalDescription =
    description != null ? description : details.description || null;

  const info = db
    .prepare(
      `INSERT INTO bookmarks
        (address, normalized_url, title, description, favicon_path, preview_image_path,
         notes, status, archived, snapshot_path, snapshot_type, snapshot_available,
         created_at, updated_at)
       VALUES (@address, @normalized_url, @title, @description, @favicon_path, @preview_image_path,
         @notes, 'unread', 0, @snapshot_path, @snapshot_type, @snapshot_available,
         @created_at, @updated_at)`
    )
    .run({
      address,
      normalized_url: normalized,
      title: finalTitle,
      description: finalDescription,
      favicon_path: details.faviconPath || null,
      preview_image_path: details.previewImagePath || null,
      notes: notes || null,
      snapshot_path: details.snapshotPath || null,
      snapshot_type: details.snapshotType || null,
      snapshot_available: details.snapshotAvailable ? 1 : 0,
      created_at: ts,
      updated_at: ts,
    });

  const id = info.lastInsertRowid;
  if (tags) setBookmarkTags(id, tags);
  return get(id);
}

// Attach snapshot info to an existing row (used when snapshot completes).
export function setSnapshot(id, { snapshotPath, snapshotType, snapshotAvailable }) {
  db.prepare(
    `UPDATE bookmarks SET snapshot_path = ?, snapshot_type = ?, snapshot_available = ?, updated_at = ?
     WHERE id = ?`
  ).run(snapshotPath || null, snapshotType || null, snapshotAvailable ? 1 : 0, nowIso(), id);
  return get(id);
}

// Edit title/description/notes/tags/status (FR-004/FR-014/FR-015).
export function update(id, fields) {
  const row = getRaw(id);
  if (!row) return null;
  const sets = [];
  const params = {};
  for (const key of ['title', 'description', 'notes', 'status']) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] = fields[key];
    }
  }
  sets.push('updated_at = @updated_at');
  params.updated_at = nowIso();
  params.id = id;
  db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  if (fields.tags !== undefined) setBookmarkTags(id, fields.tags);
  return get(id);
}

export function setArchived(id, archived) {
  const row = getRaw(id);
  if (!row) return null;
  db.prepare('UPDATE bookmarks SET archived = ?, updated_at = ? WHERE id = ?').run(
    archived ? 1 : 0,
    nowIso(),
    id
  );
  return get(id);
}

// Permanently delete a bookmark and its stored asset files (FR-017).
export function remove(id) {
  const row = getRaw(id);
  if (!row) return false;
  for (const [dir, file] of [
    ['snapshots', row.snapshot_path],
    ['thumbnails', row.preview_image_path],
    ['favicons', row.favicon_path],
  ]) {
    if (file) {
      try {
        fs.rmSync(new URL(`../../data/${dir}/${file}`, import.meta.url), { force: true });
      } catch {
        /* best effort */
      }
    }
  }
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return true;
}

// List with view scope, keyword search, tag filter, and sort (FR-011/012/013/014/016).
export function list({ view = 'all', q = '', tag = '', sort = 'created', order = 'desc' } = {}) {
  const where = [];
  const params = {};

  if (view === 'archive') where.push('b.archived = 1');
  else if (view === 'unread') where.push("b.archived = 0 AND b.status = 'unread'");
  else where.push('b.archived = 0');

  if (q && q.trim()) {
    params.q = `%${q.trim().toLowerCase()}%`;
    where.push(`(
      LOWER(b.title) LIKE @q OR LOWER(b.address) LIKE @q OR
      LOWER(IFNULL(b.description,'')) LIKE @q OR LOWER(IFNULL(b.notes,'')) LIKE @q OR
      EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
              WHERE bt.bookmark_id = b.id AND LOWER(t.name) LIKE @q)
    )`);
  }

  if (tag && tag.trim()) {
    params.tag = tag.trim().toLowerCase();
    where.push(`EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                        WHERE bt.bookmark_id = b.id AND t.name_lower = @tag)`);
  }

  const sortCol = sort === 'title' ? 'b.title COLLATE NOCASE' : 'b.created_at';
  const sortOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const rows = db
    .prepare(
      `SELECT b.* FROM bookmarks b
       WHERE ${where.join(' AND ')}
       ORDER BY ${sortCol} ${sortOrder}, b.id ${sortOrder}`
    )
    .all(params);

  return rows.map(serialize);
}
