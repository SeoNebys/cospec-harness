// Core bookmark service: CRUD, list/search, states, bulk actions.
import db from '../db/index.js';
import sanitizeHtml from 'sanitize-html';
import { canonicalKey, isValidHttpUrl } from './normalize.js';
import { parseQuery, matches } from './search.js';
import {
  setBookmarkTags,
  addBookmarkTags,
  removeBookmarkTags,
  tagsForBookmark,
  cleanupOrphanTags,
} from './tags.js';

const NOTE_SANITIZE = {
  allowedTags: ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'p', 'br'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: 'a',
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

export function sanitizeNote(html) {
  if (!html) return null;
  const clean = sanitizeHtml(html, NOTE_SANITIZE).trim();
  return clean || null;
}

const VALID_SORTS = new Set([
  'date_added_desc',
  'date_added_asc',
  'title_asc',
  'title_desc',
]);

function orderClause(sort) {
  switch (sort) {
    case 'date_added_asc':
      return 'ORDER BY date_added ASC';
    case 'title_asc':
      return 'ORDER BY title COLLATE NOCASE ASC';
    case 'title_desc':
      return 'ORDER BY title COLLATE NOCASE DESC';
    case 'date_added_desc':
    default:
      return 'ORDER BY date_added DESC';
  }
}

function rowToBookmark(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    iconUrl: row.icon_url,
    previewImageUrl: row.preview_image_url,
    noteHtml: row.note_html,
    tags: tagsForBookmark(row.id),
    isUnread: !!row.is_unread,
    isArchived: !!row.is_archived,
    preservedKind: row.preserved_kind,
    preservedPath: row.preserved_path,
    archiveOrgUrl: row.archive_org_url,
    dateAdded: row.date_added,
    updatedAt: row.updated_at,
  };
}

export class DuplicateError extends Error {
  constructor(existingId) {
    super('Duplicate bookmark');
    this.name = 'DuplicateError';
    this.existingId = existingId;
  }
}

export function findByUrl(url) {
  if (!isValidHttpUrl(url)) return null;
  const key = canonicalKey(url);
  const row = db.prepare('SELECT * FROM bookmark WHERE canonical_key = ?').get(key);
  return row ? rowToBookmark(row) : null;
}

export function getById(id) {
  const row = db.prepare('SELECT * FROM bookmark WHERE id = ?').get(id);
  return rowToBookmark(row);
}

export function create({
  url,
  title,
  description,
  iconUrl,
  previewImageUrl,
  tags,
  noteHtml,
  readLater,
}) {
  if (!isValidHttpUrl(url)) {
    const err = new Error('Invalid URL');
    err.code = 'INVALID_URL';
    throw err;
  }
  const key = canonicalKey(url);
  const existing = db
    .prepare('SELECT id FROM bookmark WHERE canonical_key = ?')
    .get(key);
  if (existing) throw new DuplicateError(existing.id);

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO bookmark
        (url, canonical_key, title, description, icon_url, preview_image_url,
         note_html, is_unread, is_archived, date_added, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      url,
      key,
      title || null,
      description || null,
      iconUrl || null,
      previewImageUrl || null,
      sanitizeNote(noteHtml),
      readLater ? 1 : 0,
      now,
      now
    );
  const id = info.lastInsertRowid;
  if (tags && tags.length) setBookmarkTags(id, tags);
  return getById(id);
}

export function update(id, fields) {
  const row = db.prepare('SELECT * FROM bookmark WHERE id = ?').get(id);
  if (!row) return null;

  const updates = {};
  if (fields.url !== undefined) {
    if (!isValidHttpUrl(fields.url)) {
      const err = new Error('Invalid URL');
      err.code = 'INVALID_URL';
      throw err;
    }
    const key = canonicalKey(fields.url);
    const clash = db
      .prepare('SELECT id FROM bookmark WHERE canonical_key = ? AND id != ?')
      .get(key, id);
    if (clash) throw new DuplicateError(clash.id);
    updates.url = fields.url;
    updates.canonical_key = key;
  }
  if (fields.title !== undefined) updates.title = fields.title || null;
  if (fields.description !== undefined)
    updates.description = fields.description || null;
  if (fields.iconUrl !== undefined) updates.icon_url = fields.iconUrl || null;
  if (fields.previewImageUrl !== undefined)
    updates.preview_image_url = fields.previewImageUrl || null;
  if (fields.noteHtml !== undefined)
    updates.note_html = sanitizeNote(fields.noteHtml);
  if (fields.isUnread !== undefined) updates.is_unread = fields.isUnread ? 1 : 0;
  if (fields.isArchived !== undefined)
    updates.is_archived = fields.isArchived ? 1 : 0;
  if (fields.preservedPath !== undefined)
    updates.preserved_path = fields.preservedPath || null;
  if (fields.preservedKind !== undefined)
    updates.preserved_kind = fields.preservedKind || null;
  if (fields.archiveOrgUrl !== undefined)
    updates.archive_org_url = fields.archiveOrgUrl || null;

  const keys = Object.keys(updates);
  if (keys.length) {
    updates.updated_at = new Date().toISOString();
    const setSql = Object.keys(updates)
      .map((k) => `${k} = @${k}`)
      .join(', ');
    db.prepare(`UPDATE bookmark SET ${setSql} WHERE id = @id`).run({
      ...updates,
      id,
    });
  }
  if (fields.tags !== undefined) setBookmarkTags(id, fields.tags);
  return getById(id);
}

export function remove(id) {
  const info = db.prepare('DELETE FROM bookmark WHERE id = ?').run(id);
  cleanupOrphanTags();
  return info.changes > 0;
}

/**
 * List bookmarks for a view with optional search + tag include/exclude,
 * sorting and pagination. Returns { items, total, page, pageSize }.
 * Throws SearchQueryError on a malformed query.
 */
export function list({
  view = 'main',
  q = '',
  tags = [],
  notTags = [],
  sort = 'date_added_desc',
  page = 1,
  pageSize = 25,
} = {}) {
  const sortKey = VALID_SORTS.has(sort) ? sort : 'date_added_desc';

  let where = '1=1';
  if (view === 'archive') where = 'is_archived = 1';
  else if (view === 'unread') where = 'is_archived = 0 AND is_unread = 1';
  else where = 'is_archived = 0'; // main

  const rows = db
    .prepare(`SELECT * FROM bookmark WHERE ${where} ${orderClause(sortKey)}`)
    .all();

  // Parse the query once (may throw SearchQueryError → surfaced to route).
  const tree = q && q.trim() ? parseQuery(q) : null;

  const includeTags = (tags || []).map((t) => String(t).toLowerCase());
  const excludeTags = (notTags || []).map((t) => String(t).toLowerCase());

  const filtered = rows
    .map(rowToBookmark)
    .filter((b) => {
      const btags = b.tags.map((t) => t.toLowerCase());
      if (includeTags.length && !includeTags.every((t) => btags.includes(t)))
        return false;
      if (excludeTags.length && excludeTags.some((t) => btags.includes(t)))
        return false;
      if (tree && !matches(tree, { ...b, note_html: b.noteHtml }))
        return false;
      return true;
    });

  const total = filtered.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, parseInt(pageSize, 10) || 25);
  const start = (p - 1) * ps;
  const items = filtered.slice(start, start + ps);
  return { items, total, page: p, pageSize: ps };
}

/** Resolve the ids matching a { view,q,tags,notTags } descriptor. */
export function resolveMatchIds(match) {
  const { items } = list({
    view: match.view || 'main',
    q: match.q || '',
    tags: match.tags || [],
    notTags: match.notTags || [],
    page: 1,
    pageSize: Number.MAX_SAFE_INTEGER,
  });
  return items.map((b) => b.id);
}

/**
 * Bulk actions (FR-019, FR-020). `target` is { ids } or { match }.
 * action is one of addTags/removeTags/setUnread/setArchived/delete.
 * Returns { updated, failures:[{id,reason}] }.
 */
export function bulk(target, action) {
  let ids = [];
  if (Array.isArray(target.ids)) ids = target.ids.slice();
  else if (target.match) ids = resolveMatchIds(target.match);

  let updated = 0;
  const failures = [];

  for (const id of ids) {
    try {
      const exists = db.prepare('SELECT id FROM bookmark WHERE id = ?').get(id);
      if (!exists) {
        failures.push({ id, reason: 'not found' });
        continue;
      }
      switch (action.action) {
        case 'addTags':
          addBookmarkTags(id, action.tags || []);
          break;
        case 'removeTags':
          removeBookmarkTags(id, action.tags || []);
          break;
        case 'setUnread':
          update(id, { isUnread: !!action.value });
          break;
        case 'setArchived':
          update(id, { isArchived: !!action.value });
          break;
        case 'delete':
          remove(id);
          break;
        default:
          failures.push({ id, reason: 'unknown action' });
          continue;
      }
      updated++;
    } catch (e) {
      failures.push({ id, reason: e.message });
    }
  }
  return { updated, failures };
}
