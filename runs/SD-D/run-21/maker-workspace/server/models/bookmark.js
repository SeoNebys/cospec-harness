import db from '../db/connection.js';
import { getBookmarkTags, setBookmarkTags } from './tag.js';

// Bookmark data-access (T013). Returns the response shape from contracts/api.md.

function nowIso() {
  return new Date().toISOString();
}

function captureFor(bookmarkId) {
  const row = db
    .prepare('SELECT kind, status FROM page_capture WHERE bookmark_id = ? ORDER BY id DESC LIMIT 1')
    .get(bookmarkId);
  return row ? { kind: row.kind, status: row.status } : null;
}

function snapshotFor(bookmarkId) {
  const row = db
    .prepare('SELECT snapshot_url, status FROM archive_snapshot WHERE bookmark_id = ? ORDER BY id DESC LIMIT 1')
    .get(bookmarkId);
  return row ? { status: row.status, snapshotUrl: row.snapshot_url || null } : null;
}

export function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description || null,
    noteHtml: row.note_html || null,
    iconUrl: row.icon_path || null,
    previewImageUrl: row.preview_image_url || null,
    isRead: !!row.is_read,
    isArchived: !!row.is_archived,
    tags: getBookmarkTags(row.id),
    capture: captureFor(row.id),
    archiveSnapshot: snapshotFor(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getRawByUrl(url) {
  return db.prepare('SELECT * FROM bookmark WHERE url = ?').get(url);
}

export function getById(id) {
  return serialize(db.prepare('SELECT * FROM bookmark WHERE id = ?').get(id));
}

export function getRawById(id) {
  return db.prepare('SELECT * FROM bookmark WHERE id = ?').get(id);
}

export function create({ url, title, description, noteHtml, noteText, iconUrl, previewImageUrl, tags }) {
  const ts = nowIso();
  const info = db
    .prepare(
      `INSERT INTO bookmark (url, title, description, note_html, note_text, icon_path, preview_image_url, is_read, is_archived, created_at, updated_at)
       VALUES (@url, @title, @description, @note_html, @note_text, @icon_path, @preview_image_url, 0, 0, @created_at, @updated_at)`
    )
    .run({
      url,
      title: title && String(title).trim() ? String(title).trim() : url,
      description: description || null,
      note_html: noteHtml || null,
      note_text: noteText || null,
      icon_path: iconUrl || null,
      preview_image_url: previewImageUrl || null,
      created_at: ts,
      updated_at: ts,
    });
  const id = info.lastInsertRowid;
  if (tags) setBookmarkTags(id, tags);
  return getById(id);
}

export function update(id, fields) {
  const existing = getRawById(id);
  if (!existing) return null;
  const map = {
    url: 'url',
    title: 'title',
    description: 'description',
    noteHtml: 'note_html',
    noteText: 'note_text',
    iconUrl: 'icon_path',
    previewImageUrl: 'preview_image_url',
  };
  const sets = [];
  const params = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in fields && fields[key] !== undefined) {
      sets.push(`${col} = @${col}`);
      params[col] = fields[key];
    }
  }
  // is_read and is_archived set independently (never one via the other).
  if ('isRead' in fields && fields.isRead !== undefined) {
    sets.push('is_read = @is_read');
    params.is_read = fields.isRead ? 1 : 0;
  }
  if ('isArchived' in fields && fields.isArchived !== undefined) {
    sets.push('is_archived = @is_archived');
    params.is_archived = fields.isArchived ? 1 : 0;
  }
  if (sets.length) {
    params.id = id;
    params.updated_at = nowIso();
    db.prepare(`UPDATE bookmark SET ${sets.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
  }
  if ('tags' in fields && fields.tags !== undefined) setBookmarkTags(id, fields.tags);
  return getById(id);
}

export function remove(id) {
  // ON DELETE CASCADE removes bookmark_tag links, page_capture and
  // archive_snapshot rows. Tag rows are never deleted here (FR-018).
  return db.prepare('DELETE FROM bookmark WHERE id = ?').run(id).changes > 0;
}

// Returns raw rows filtered by view + tags; ordering applied by sort.
export function listRaw({ view = 'normal', includeTags = [], excludeTags = [], sort = 'newest' } = {}) {
  const where = [];
  const params = {};
  if (view === 'normal') where.push('b.is_archived = 0');
  else if (view === 'read_later') where.push('b.is_archived = 0 AND b.is_read = 0');
  else if (view === 'archive') where.push('b.is_archived = 1');

  includeTags.forEach((t, i) => {
    where.push(
      `EXISTS (SELECT 1 FROM bookmark_tag bt JOIN tag tg ON tg.id = bt.tag_id
        WHERE bt.bookmark_id = b.id AND tg.name = @inc${i} COLLATE NOCASE)`
    );
    params[`inc${i}`] = t;
  });
  excludeTags.forEach((t, i) => {
    where.push(
      `NOT EXISTS (SELECT 1 FROM bookmark_tag bt JOIN tag tg ON tg.id = bt.tag_id
        WHERE bt.bookmark_id = b.id AND tg.name = @exc${i} COLLATE NOCASE)`
    );
    params[`exc${i}`] = t;
  });

  const orderMap = {
    newest: 'b.created_at DESC',
    oldest: 'b.created_at ASC',
    title_az: 'b.title COLLATE NOCASE ASC',
    title_za: 'b.title COLLATE NOCASE DESC',
    recently_updated: 'b.updated_at DESC',
  };
  const order = orderMap[sort] || orderMap.newest;
  const sql = `SELECT b.* FROM bookmark b ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`;
  const stmt = db.prepare(sql);
  return Object.keys(params).length ? stmt.all(params) : stmt.all();
}
