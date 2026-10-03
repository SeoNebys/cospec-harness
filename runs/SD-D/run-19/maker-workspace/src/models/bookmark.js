import { unlinkSync, existsSync } from 'node:fs';
import { getDb } from '../db/index.js';
import { canonicalKey, deriveTitle, parseHttpUrl } from '../lib/url.js';
import { renderMarkdown } from '../lib/markdown.js';
import { compileSearch } from '../services/search/compile.js';
import { setBookmarkTags, tagsForBookmark, addTagsToBookmarks, removeTagsFromBookmarks } from './tag.js';

const SORTS = {
  date_added_desc: 'b.date_added DESC',
  date_added_asc: 'b.date_added ASC',
  title_asc: 'b.title COLLATE NOCASE ASC',
  title_desc: 'b.title COLLATE NOCASE DESC',
};

export class ConflictError extends Error {
  constructor(message, existingId) { super(message); this.name = 'ConflictError'; this.existingId = existingId; }
}

function now() { return new Date().toISOString(); }

function rowToBookmark(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    urlKey: row.url_key,
    title: row.title,
    description: row.description,
    noteMd: row.note_md,
    noteHtml: renderMarkdown(row.note_md),
    faviconUrl: row.favicon_url,
    previewImageUrl: row.preview_image_url,
    isRead: !!row.is_read,
    isArchived: !!row.is_archived,
    metadataUnavailable: !!row.metadata_unavailable,
    preservedHtmlPath: row.preserved_html_path,
    preservedPdfPath: row.preserved_pdf_path,
    archiveOrgUrl: row.archive_org_url,
    dateAdded: row.date_added,
    dateModified: row.date_modified,
    tags: tagsForBookmark(row.id),
  };
}

export function findByUrlKey(key) {
  return getDb().prepare('SELECT * FROM bookmark WHERE url_key = ?').get(key);
}

export function getById(id) {
  return rowToBookmark(getDb().prepare('SELECT * FROM bookmark WHERE id = ?').get(id));
}

/**
 * Create a bookmark. Throws ConflictError (with existingId) if the canonical URL
 * already exists, so the caller can route to editing the existing bookmark.
 */
export function createBookmark(input) {
  const db = getDb();
  parseHttpUrl(input.url); // throws InvalidUrlError on bad URL
  const key = canonicalKey(input.url);
  const existing = findByUrlKey(key);
  if (existing) throw new ConflictError('Bookmark already exists', existing.id);

  const ts = now();
  const title = (input.title && String(input.title).trim()) || deriveTitle(input.url);
  const info = db.prepare(
    `INSERT INTO bookmark (url, url_key, title, description, note_md, favicon_url,
       preview_image_url, is_read, is_archived, metadata_unavailable, date_added, date_modified)
     VALUES (@url, @url_key, @title, @description, @note_md, @favicon_url,
       @preview_image_url, 0, 0, @metadata_unavailable, @date_added, @date_modified)`
  ).run({
    url: input.url,
    url_key: key,
    title,
    description: input.description ?? null,
    note_md: input.noteMd ?? null,
    favicon_url: input.faviconUrl ?? null,
    preview_image_url: input.previewImageUrl ?? null,
    metadata_unavailable: input.metadataUnavailable ? 1 : 0,
    date_added: ts,
    date_modified: ts,
  });
  const id = info.lastInsertRowid;
  if (input.tags) setBookmarkTags(id, input.tags);
  return getById(id);
}

/** Update mutable fields of a bookmark. Throws ConflictError on url_key clash. */
export function updateBookmark(id, patch) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM bookmark WHERE id = ?').get(id);
  if (!current) return null;

  const fields = {};
  if (patch.url !== undefined) {
    parseHttpUrl(patch.url);
    const key = canonicalKey(patch.url);
    const clash = findByUrlKey(key);
    if (clash && clash.id !== id) throw new ConflictError('Another bookmark already uses this address', clash.id);
    fields.url = patch.url;
    fields.url_key = key;
  }
  if (patch.title !== undefined) fields.title = String(patch.title).trim() || deriveTitle(fields.url || current.url);
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.noteMd !== undefined) fields.note_md = patch.noteMd;
  if (patch.faviconUrl !== undefined) fields.favicon_url = patch.faviconUrl;
  if (patch.previewImageUrl !== undefined) fields.preview_image_url = patch.previewImageUrl;
  if (patch.isRead !== undefined) fields.is_read = patch.isRead ? 1 : 0;
  if (patch.isArchived !== undefined) fields.is_archived = patch.isArchived ? 1 : 0;

  if (Object.keys(fields).length) {
    fields.date_modified = now();
    const setClause = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE bookmark SET ${setClause} WHERE id = @id`).run({ ...fields, id });
  }
  if (patch.tags !== undefined) setBookmarkTags(id, patch.tags);
  return getById(id);
}

export function setBookmarkFields(id, dbFields) {
  const db = getDb();
  const withTs = { ...dbFields, date_modified: now() };
  const setClause = Object.keys(withTs).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE bookmark SET ${setClause} WHERE id = @id`).run({ ...withTs, id });
  return getById(id);
}

export function deleteBookmark(id) {
  const db = getDb();
  const row = db.prepare('SELECT preserved_html_path, preserved_pdf_path FROM bookmark WHERE id = ?').get(id);
  if (!row) return false;
  for (const p of [row.preserved_html_path, row.preserved_pdf_path]) {
    if (p && existsSync(p)) { try { unlinkSync(p); } catch { /* ignore */ } }
  }
  db.prepare('DELETE FROM bookmark WHERE id = ?').run(id);
  return true;
}

// ---- Listing / view resolution -------------------------------------------

function buildWhere({ q, includeTags = [], excludeTags = [], scope = 'all' }) {
  const clauses = [];
  const params = [];

  if (scope === 'archive') clauses.push('b.is_archived = 1');
  else clauses.push('b.is_archived = 0');
  if (scope === 'unread') clauses.push('b.is_read = 0');

  const { sql, params: searchParams } = compileSearch(q || '');
  if (sql) { clauses.push(sql); params.push(...searchParams); }

  for (const tag of includeTags.filter(Boolean)) {
    clauses.push(`EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tag t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`);
    params.push(tag);
  }
  for (const tag of excludeTags.filter(Boolean)) {
    clauses.push(`NOT EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tag t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`);
    params.push(tag);
  }

  return { where: clauses.join(' AND '), params };
}

/** List bookmarks for a view with sort + paging. Returns {items,total,page,pageSize}. */
export function listBookmarks(opts = {}) {
  const db = getDb();
  const { where, params } = buildWhere(opts);
  const sort = SORTS[opts.sort] || SORTS.date_added_desc;
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(opts.pageSize, 10) || 25));

  const total = db.prepare(`SELECT COUNT(*) AS n FROM bookmark b WHERE ${where}`).get(...params).n;
  const rows = db.prepare(
    `SELECT b.* FROM bookmark b WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize);

  return { items: rows.map(rowToBookmark), total, page, pageSize };
}

/** Resolve every bookmark id matching a view (no paging) — for select-all bulk. */
export function resolveMatchingIds(opts = {}) {
  const db = getDb();
  const { where, params } = buildWhere(opts);
  return db.prepare(`SELECT b.id FROM bookmark b WHERE ${where}`).all(...params).map((r) => r.id);
}

// ---- Bulk actions ---------------------------------------------------------

export function applyBulkAction(ids, action, tags = []) {
  const db = getDb();
  if (!ids.length) return 0;
  switch (action) {
    case 'addTags': addTagsToBookmarks(ids, tags); break;
    case 'removeTags': removeTagsFromBookmarks(ids, tags); break;
    case 'markRead': setFlag(ids, 'is_read', 1); break;
    case 'markUnread': setFlag(ids, 'is_read', 0); break;
    case 'archive': setFlag(ids, 'is_archived', 1); break;
    case 'restore': setFlag(ids, 'is_archived', 0); break;
    case 'delete': { const tx = db.transaction(() => ids.forEach(deleteBookmark)); tx(); break; }
    default: throw new Error(`Unknown bulk action: ${action}`);
  }
  return ids.length;
}

function setFlag(ids, column, value) {
  const db = getDb();
  const stmt = db.prepare(`UPDATE bookmark SET ${column} = ?, date_modified = ? WHERE id = ?`);
  const ts = now();
  const tx = db.transaction(() => ids.forEach((id) => stmt.run(value, ts, id)));
  tx();
}
