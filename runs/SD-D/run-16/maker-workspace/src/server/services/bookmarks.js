// Bookmark domain logic: validation, dedup, CRUD, and listing.
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import { config } from '../config.js';
import { fetchMetadata } from './metadata.js';
import { setBookmarkTags, getTagsForBookmark, pruneUnusedTags } from './tags.js';

function nowIso() {
  return new Date().toISOString();
}

export function validateAddress(address) {
  const value = String(address || '').trim();
  if (!value) {
    const e = new Error('An address is required.');
    e.status = 400;
    e.code = 'address_required';
    throw e;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    const e = new Error('That is not a valid web address.');
    e.status = 400;
    e.code = 'address_invalid';
    throw e;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    const e = new Error('Only http and https addresses are supported.');
    e.status = 400;
    e.code = 'address_invalid';
    throw e;
  }
  return url.href;
}

function rowToBookmark(row) {
  if (!row) return null;
  return {
    id: row.id,
    address: row.address,
    title: row.title,
    description: row.description,
    note: row.note,
    iconUrl: row.icon_url,
    previewImageUrl: row.preview_image_url,
    isUnread: !!row.is_unread,
    isArchived: !!row.is_archived,
    dateAdded: row.date_added,
    dateUpdated: row.date_updated,
    preservedCopyPath: row.preserved_copy_path,
    preservedCopyKind: row.preserved_copy_kind,
    preservedAt: row.preserved_at,
    archiveOrgUrl: row.archive_org_url,
    archiveOrgAt: row.archive_org_at,
    tags: getTagsForBookmark(row.id),
  };
}

export function getBookmark(id) {
  const db = getDb();
  return rowToBookmark(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
}

export function getBookmarkByAddress(address) {
  const db = getDb();
  return rowToBookmark(db.prepare('SELECT * FROM bookmarks WHERE address = ?').get(address));
}

// Low-level synchronous insert (no network). Caller supplies fields.
export function createBookmark(input) {
  const db = getDb();
  const address = validateAddress(input.address);
  const ts = nowIso();
  const dateAdded = input.dateAdded || ts;
  const info = db
    .prepare(
      `INSERT INTO bookmarks
        (address, title, description, note, icon_url, preview_image_url, is_unread, is_archived, date_added, date_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      address,
      input.title ?? address,
      input.description ?? null,
      input.note ?? null,
      input.iconUrl ?? null,
      input.previewImageUrl ?? null,
      input.isUnread === false ? 0 : 1, // default unread (FR-020)
      input.isArchived ? 1 : 0,
      dateAdded,
      ts
    );
  const id = Number(info.lastInsertRowid);
  if (input.tags) setBookmarkTags(id, input.tags);
  return getBookmark(id);
}

// High-level save used by the API: validate → dedup → capture metadata → insert.
export async function saveBookmark(input) {
  const address = validateAddress(input.address);
  const existing = getBookmarkByAddress(address);
  if (existing) {
    return { bookmark: existing, existing: true };
  }
  const meta = input.skipMetadata ? {} : await fetchMetadata(address);
  const bookmark = createBookmark({
    address,
    title: input.title || meta.title || address,
    description: input.description ?? meta.description ?? null,
    note: input.note ?? null,
    iconUrl: meta.icon ?? null,
    previewImageUrl: meta.previewImage ?? null,
    tags: input.tags || [],
  });
  return { bookmark, existing: false };
}

export function updateBookmark(id, patch) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!current) {
    const e = new Error('Bookmark not found.');
    e.status = 404;
    e.code = 'not_found';
    throw e;
  }
  const fields = {};
  if (patch.title !== undefined) fields.title = patch.title;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.note !== undefined) fields.note = patch.note;
  if (patch.isUnread !== undefined) fields.is_unread = patch.isUnread ? 1 : 0;
  if (patch.isArchived !== undefined) fields.is_archived = patch.isArchived ? 1 : 0;
  if (patch.address !== undefined) {
    const newAddress = validateAddress(patch.address);
    const clash = db.prepare('SELECT id FROM bookmarks WHERE address = ? AND id != ?').get(newAddress, id);
    if (clash) {
      const e = new Error('Another bookmark already uses that address.');
      e.status = 409;
      e.code = 'address_conflict';
      throw e;
    }
    fields.address = newAddress;
  }

  const keys = Object.keys(fields);
  if (keys.length) {
    fields.date_updated = nowIso();
    const setClause = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE bookmarks SET ${setClause} WHERE id = @id`).run({ ...fields, id });
  }
  if (patch.tags !== undefined) {
    setBookmarkTags(id, patch.tags);
    db.prepare('UPDATE bookmarks SET date_updated = ? WHERE id = ?').run(nowIso(), id);
  }
  return getBookmark(id);
}

export function deleteBookmark(id) {
  const db = getDb();
  const row = db.prepare('SELECT preserved_copy_path FROM bookmarks WHERE id = ?').get(id);
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  if (info.changes > 0) pruneUnusedTags(); // cascade removed links; drop now-orphaned tags
  if (info.changes > 0 && row && row.preserved_copy_path) {
    // Remove the preserved file (path is stored relative to the preserved dir).
    try {
      fs.rmSync(path.join(config.preservedDir, row.preserved_copy_path), { force: true });
    } catch {
      /* ignore cleanup errors */
    }
  }
  return info.changes > 0;
}

function viewWhere(view) {
  if (view === 'archived') return 'is_archived = 1';
  if (view === 'unread') return 'is_archived = 0 AND is_unread = 1';
  return 'is_archived = 0'; // normal
}

function sortOrder(sort) {
  switch (sort) {
    case 'oldest':
      return 'date_added ASC';
    case 'title':
      return 'title COLLATE NOCASE ASC';
    case 'updated':
      return 'date_updated DESC';
    case 'newest':
    default:
      return 'date_added DESC';
  }
}

export function listBookmarks({ view = 'normal', tag = null, sort = 'newest', limit = null, offset = 0 } = {}) {
  const db = getDb();
  const where = [viewWhere(view)];
  const params = {};
  let join = '';
  if (tag) {
    join = 'JOIN bookmark_tags bt ON bt.bookmark_id = b.id JOIN tags t ON t.id = bt.tag_id';
    where.push('t.name = @tag COLLATE NOCASE');
    params.tag = tag;
  }
  const whereClause = where.join(' AND ');
  const total = db
    .prepare(`SELECT COUNT(DISTINCT b.id) AS c FROM bookmarks b ${join} WHERE ${whereClause}`)
    .get(params).c;

  let sql = `SELECT DISTINCT b.* FROM bookmarks b ${join} WHERE ${whereClause} ORDER BY ${sortOrder(sort)}`;
  if (limit != null) {
    sql += ' LIMIT @limit OFFSET @offset';
    params.limit = limit;
    params.offset = offset;
  }
  const rows = db.prepare(sql).all(params);
  return { items: rows.map(rowToBookmark), total };
}

// All candidate rows for in-memory search evaluation (excludes archived unless asked).
export function candidatesForSearch({ view = 'normal' } = {}) {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM bookmarks WHERE ${viewWhere(view)}`).all();
  return rows.map(rowToBookmark);
}
