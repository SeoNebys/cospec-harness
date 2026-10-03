import { getDb } from '../db/index.js';
import { prep } from '../db/prep.js';
import { normalizeKey } from '../services/url.js';
import { sanitizeNote, toPlainText } from '../services/sanitize.js';
import { parseQuery, evaluate } from '../services/search.js';
import {
  setBookmarkTags,
  addBookmarkTags,
  removeBookmarkTags,
  tagsForBookmark,
} from './tag.js';

const SORTS = new Set([
  'added_desc',
  'added_asc',
  'title',
  'updated_desc',
  'read_status',
]);

function nowIso() {
  return new Date().toISOString();
}

function orderClause(sort) {
  switch (sort) {
    case 'added_asc':
      return 'created_at ASC';
    case 'title':
      return 'title COLLATE NOCASE ASC';
    case 'updated_desc':
      return 'updated_at DESC';
    case 'read_status':
      return 'is_read ASC, created_at DESC';
    case 'added_desc':
    default:
      return 'created_at DESC';
  }
}

export function rowToBookmark(row, db = getDb()) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    note_html: row.note_html,
    icon_url: row.icon_url,
    preview_image_url: row.preview_image_url,
    is_read: !!row.is_read,
    is_archived: !!row.is_archived,
    tags: tagsForBookmark(row.id, db),
    preserved: prep(
      db,
      'SELECT id, kind, location, captured_at FROM preserved_copies WHERE bookmark_id = ? ORDER BY captured_at'
    ).all(row.id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getRawByKey(urlKey, db = getDb()) {
  return prep(db, 'SELECT * FROM bookmarks WHERE url_key = ?').get(urlKey);
}

export function getById(id, db = getDb()) {
  const row = prep(db, 'SELECT * FROM bookmarks WHERE id = ?').get(id);
  return rowToBookmark(row, db);
}

// Create a bookmark. Caller must have checked for duplicates first (routes do).
export function createBookmark(
  { url, title = '', description = '', note_html = '', icon_url = null, preview_image_url = null, is_read = 0, tags = [] },
  db = getDb()
) {
  const urlKey = normalizeKey(url);
  const noteHtml = sanitizeNote(note_html);
  const noteText = toPlainText(noteHtml);
  const ts = nowIso();
  const info = prep(
    db,
    `INSERT INTO bookmarks
        (url, url_key, title, description, note_html, note_text, icon_url, preview_image_url, is_read, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
      url,
      urlKey,
      title || url,
      description,
      noteHtml,
      noteText,
      icon_url,
      preview_image_url,
      is_read ? 1 : 0,
      ts,
      ts
    );
  const id = info.lastInsertRowid;
  setBookmarkTags(id, tags, db);
  return getById(id, db);
}

// Partial update of editable fields (FR-003/009/021/023/024).
export function updateBookmark(id, patch, db = getDb()) {
  const row = prep(db, 'SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!row) return null;
  const fields = {};
  if (patch.url !== undefined) {
    fields.url = patch.url;
    fields.url_key = normalizeKey(patch.url);
  }
  if (patch.title !== undefined) fields.title = patch.title;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.note_html !== undefined) {
    fields.note_html = sanitizeNote(patch.note_html);
    fields.note_text = toPlainText(fields.note_html);
  }
  if (patch.icon_url !== undefined) fields.icon_url = patch.icon_url;
  if (patch.preview_image_url !== undefined)
    fields.preview_image_url = patch.preview_image_url;
  if (patch.is_read !== undefined) fields.is_read = patch.is_read ? 1 : 0;
  if (patch.is_archived !== undefined)
    fields.is_archived = patch.is_archived ? 1 : 0;
  fields.updated_at = nowIso();

  const keys = Object.keys(fields);
  if (keys.length > 0) {
    const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE bookmarks SET ${setClause} WHERE id = @id`).run({
      ...fields,
      id,
    });
  }
  if (patch.tags !== undefined) setBookmarkTags(id, patch.tags, db);
  return getById(id, db);
}

export function deleteBookmark(id, db = getDb()) {
  return prep(db, 'DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
}

// --- Shared view resolver (FR-025/025a) -----------------------------------
// Resolves the COMPLETE current view to a set of matching rows. Reused by the
// browse list (GET /api/bookmarks) and by bulk actions so they stay in lockstep.
//
// filters: { q, tag[], included_tags[], excluded_tags[], view, saved_view_id }
// Returns matching rows (already ordered when `sort` given), before pagination.
export function resolveMatching(filters = {}, db = getDb()) {
  let { q = '', included_tags = [], excluded_tags = [], view = 'active' } = filters;
  const quickTags = toArray(filters.tag);
  included_tags = toArray(included_tags);
  excluded_tags = toArray(excluded_tags);

  // A saved view expands to its exact stored filters (FR-025a).
  if (filters.saved_view_id) {
    const sv = db
      .prepare('SELECT * FROM saved_views WHERE id = ?')
      .get(filters.saved_view_id);
    if (sv) {
      q = sv.query || '';
      included_tags = JSON.parse(sv.included_tags || '[]');
      excluded_tags = JSON.parse(sv.excluded_tags || '[]');
    }
  }

  // Quick tag-filters (FR-014a) are additional required tags.
  const requiredTags = [...included_tags, ...quickTags].map((t) =>
    String(t).toLowerCase()
  );
  const excludedTagsLc = excluded_tags.map((t) => String(t).toLowerCase());

  // Base rows by archive/read view.
  let sql = 'SELECT * FROM bookmarks';
  const where = [];
  if (view === 'archive') {
    where.push('is_archived = 1');
  } else if (view === 'unread') {
    where.push('is_read = 0');
    where.push('is_archived = 0');
  } else {
    // active (default): exclude archived (FR-020/023)
    where.push('is_archived = 0');
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const rows = prep(db, sql).all();

  // Parse the search query once (throws SearchQueryError on malformed).
  const ast = parseQuery(q);

  const matched = rows.filter((row) => {
    const tags = tagsForBookmark(row.id, db);
    const tagsLc = tags.map((t) => t.toLowerCase());
    // Required tags (included + quick).
    for (const rt of requiredTags) {
      if (!tagsLc.includes(rt)) return false;
    }
    // Excluded tags.
    for (const et of excludedTagsLc) {
      if (tagsLc.includes(et)) return false;
    }
    // Search predicate.
    if (ast) {
      const doc = {
        title: row.title,
        description: row.description,
        note_text: row.note_text,
        url: row.url,
        tags,
      };
      if (!evaluate(ast, doc)) return false;
    }
    return true;
  });

  return matched;
}

// Browse list with sort + pagination (FR-005/014/028/040).
export function list(filters = {}, db = getDb()) {
  const matched = resolveMatching(filters, db);
  const sort = SORTS.has(filters.sort) ? filters.sort : 'added_desc';
  sortRows(matched, sort);

  const total = matched.length;
  const pageSize = Math.max(1, parseInt(filters.page_size, 10) || 25);
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const start = (page - 1) * pageSize;
  const pageRows = matched.slice(start, start + pageSize);

  return {
    items: pageRows.map((r) => rowToBookmark(r, db)),
    total,
    page,
    page_size: pageSize,
  };
}

function sortRows(rows, sort) {
  rows.sort((a, b) => {
    switch (sort) {
      case 'added_asc':
        return cmp(a.created_at, b.created_at);
      case 'title':
        return cmp(
          (a.title || '').toLowerCase(),
          (b.title || '').toLowerCase()
        );
      case 'updated_desc':
        return cmp(b.updated_at, a.updated_at);
      case 'read_status':
        return a.is_read - b.is_read || cmp(b.created_at, a.created_at);
      case 'added_desc':
      default:
        return cmp(b.created_at, a.created_at);
    }
  });
}

function cmp(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// --- Bulk actions (FR-025/026/027) ----------------------------------------
// selector: { ids: [] } or { matching: <filters incl. saved_view_id> }
export function resolveSelectorIds(selector, db = getDb()) {
  if (selector && Array.isArray(selector.ids)) {
    return selector.ids.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
  }
  if (selector && selector.matching) {
    return resolveMatching(selector.matching, db).map((r) => r.id);
  }
  return [];
}

export function bulkCount(selector, db = getDb()) {
  return resolveSelectorIds(selector, db).length;
}

// Apply a bulk action; returns number of items actually changed (FR-027).
export function bulkApply(selector, action, db = getDb()) {
  const ids = resolveSelectorIds(selector, db);
  if (ids.length === 0) return 0;
  const ts = nowIso();
  const txn = db.transaction(() => {
    if (action.delete) {
      const stmt = prep(db, 'DELETE FROM bookmarks WHERE id = ?');
      for (const id of ids) stmt.run(id);
      return ids.length;
    }
    if (action.addTags) {
      for (const id of ids) addBookmarkTags(id, action.addTags, db);
    }
    if (action.removeTags) {
      for (const id of ids) removeBookmarkTags(id, action.removeTags, db);
    }
    if (action.is_read !== undefined) {
      const stmt = db.prepare(
        'UPDATE bookmarks SET is_read = ?, updated_at = ? WHERE id = ?'
      );
      for (const id of ids) stmt.run(action.is_read ? 1 : 0, ts, id);
    }
    if (action.is_archived !== undefined) {
      const stmt = db.prepare(
        'UPDATE bookmarks SET is_archived = ?, updated_at = ? WHERE id = ?'
      );
      for (const id of ids) stmt.run(action.is_archived ? 1 : 0, ts, id);
    }
    return ids.length;
  });
  return txn();
}
