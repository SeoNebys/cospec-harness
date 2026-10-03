'use strict';

const path = require('path');
const fs = require('fs');
const { db, SNAP_DIR } = require('./db');
const { normalizeUrl, buildSearch } = require('./search');

const SORTS = {
  created_desc: 'b.created_at DESC, b.id DESC',
  created_asc: 'b.created_at ASC, b.id ASC',
  updated_desc: 'b.updated_at DESC, b.id DESC',
  updated_asc: 'b.updated_at ASC, b.id ASC',
  title_asc: 'b.title COLLATE NOCASE ASC, b.id DESC',
  title_desc: 'b.title COLLATE NOCASE DESC, b.id DESC',
  url_asc: 'b.url COLLATE NOCASE ASC, b.id DESC'
};

function viewClause(view) {
  switch (view) {
    case 'unread': return 'b.archived = 0 AND b.unread = 1';
    case 'favorites': return 'b.archived = 0 AND b.favorite = 1';
    case 'archived': return 'b.archived = 1';
    case 'all':
    default: return 'b.archived = 0';
  }
}

function buildWhere(view, query) {
  const parts = [viewClause(view)];
  const params = [];
  if (query && query.trim()) {
    const { sql, params: p } = buildSearch(query);
    parts.push('(' + sql + ')');
    params.push(...p);
  }
  return { where: parts.join(' AND '), params };
}

// ---- tags ----------------------------------------------------------------
const _getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
const _insTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
function tagId(name) {
  const row = _getTagId.get(name);
  if (row) return row.id;
  return _insTag.run(name).lastInsertRowid;
}

const _tagsFor = db.prepare('SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE');
function tagsForBookmark(id) { return _tagsFor.all(id).map((r) => r.name); }

const _clearTags = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?');
const _linkTag = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
function setTags(bookmarkId, names) {
  _clearTags.run(bookmarkId);
  const seen = new Set();
  for (const raw of names || []) {
    const name = String(raw).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    _linkTag.run(bookmarkId, tagId(name));
  }
}
function addTag(bookmarkId, name) {
  const n = String(name).trim();
  if (n) _linkTag.run(bookmarkId, tagId(n));
}
const _unlinkTag = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)');
function removeTag(bookmarkId, name) { _unlinkTag.run(bookmarkId, String(name).trim()); }

function pruneOrphanTags() {
  db.prepare('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)').run();
}

function tagFacets() {
  return db.prepare(`
    SELECT t.name AS name, COUNT(*) AS count
    FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
    JOIN bookmarks b ON b.id = bt.bookmark_id
    WHERE b.archived = 0
    GROUP BY t.id ORDER BY count DESC, t.name COLLATE NOCASE
  `).all();
}

// ---- bookmarks -----------------------------------------------------------
function hydrate(row) {
  if (!row) return null;
  row.tags = tagsForBookmark(row.id);
  row.favorite = !!row.favorite;
  row.unread = !!row.unread;
  row.archived = !!row.archived;
  row.has_snapshot = !!(row.snapshot_html || row.snapshot_pdf);
  return row;
}

const _getById = db.prepare('SELECT * FROM bookmarks WHERE id = ?');
function getBookmark(id) { return hydrate(_getById.get(id)); }

const _getByNorm = db.prepare('SELECT * FROM bookmarks WHERE url_norm = ? LIMIT 1');
function findByUrl(url) { return hydrate(_getByNorm.get(normalizeUrl(url))); }

const _insBookmark = db.prepare(`
  INSERT INTO bookmarks (url, url_norm, title, description, notes, favicon, favorite, unread, created_at, updated_at)
  VALUES (@url, @url_norm, @title, @description, @notes, @favicon, @favorite, @unread,
          COALESCE(@created_at, datetime('now')), datetime('now'))
`);

function createBookmark(data) {
  const url = String(data.url || '').trim();
  const row = {
    url,
    url_norm: normalizeUrl(url),
    title: String(data.title || '').trim(),
    description: String(data.description || ''),
    notes: String(data.notes || ''),
    favicon: String(data.favicon || ''),
    favorite: data.favorite ? 1 : 0,
    unread: data.unread === false ? 0 : 1,
    created_at: data.created_at || null
  };
  const info = _insBookmark.run(row);
  const id = info.lastInsertRowid;
  if (data.tags) setTags(id, data.tags);
  return getBookmark(id);
}

const UPDATABLE = ['url', 'title', 'description', 'notes', 'favicon', 'favorite', 'unread', 'archived',
  'snapshot_html', 'snapshot_pdf', 'snapshot_at', 'archive_url'];

function updateBookmark(id, fields) {
  const existing = _getById.get(id);
  if (!existing) return null;
  const sets = [];
  const params = {};
  for (const key of UPDATABLE) {
    if (!(key in fields)) continue;
    let val = fields[key];
    if (['favorite', 'unread', 'archived'].includes(key)) val = val ? 1 : 0;
    if (key === 'url') { params.url_norm = normalizeUrl(String(val)); sets.push('url_norm = @url_norm'); }
    params[key] = val;
    sets.push(`${key} = @${key}`);
  }
  if (sets.length) {
    params.id = id;
    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  if (fields.tags) setTags(id, fields.tags);
  return getBookmark(id);
}

function deleteBookmark(id) {
  const dir = path.join(SNAP_DIR, String(id));
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function listBookmarks({ view = 'all', query = '', sort = 'created_desc', limit = 25, offset = 0 }) {
  const { where, params } = buildWhere(view, query);
  const orderBy = SORTS[sort] || SORTS.created_desc;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM bookmarks b WHERE ${where}`).get(...params).n;
  let sql = `SELECT * FROM bookmarks b WHERE ${where} ORDER BY ${orderBy}`;
  const qp = [...params];
  if (limit >= 0) { sql += ' LIMIT ? OFFSET ?'; qp.push(limit, offset); }
  const rows = db.prepare(sql).all(...qp).map(hydrate);
  return { items: rows, total };
}

function matchingIds({ view = 'all', query = '' }) {
  const { where, params } = buildWhere(view, query);
  return db.prepare(`SELECT id FROM bookmarks b WHERE ${where}`).all(...params).map((r) => r.id);
}

module.exports = {
  createBookmark, updateBookmark, deleteBookmark, getBookmark, findByUrl,
  listBookmarks, matchingIds, tagFacets, setTags, addTag, removeTag, tagsForBookmark,
  pruneOrphanTags
};
