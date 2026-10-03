import express from 'express';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { db, SNAPSHOT_DIR, transaction } from '../db.js';
import { normalize, deriveTitle, ValidationError } from '../services/url.js';
import { fetchMetadata } from '../services/metadata.js';
import { captureOffline } from '../services/capture.js';
import { buildWhere } from '../services/search.js';
import { sanitizeNotes, toPlainText } from '../services/notes.js';
import {
  serializeBookmark, getBookmark, getBookmarkRow, findByNormalized,
  setTags,
} from '../repo.js';

export const router = express.Router();

// Express 4 does not forward rejected promises from async handlers; wrap them.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SORTS = {
  date_added_desc: 'b.saved_date DESC',
  date_added_asc: 'b.saved_date ASC',
  title_asc: 'b.title COLLATE NOCASE ASC',
  title_desc: 'b.title COLLATE NOCASE DESC',
};

const getFilterStmt = db.prepare('SELECT * FROM saved_filters WHERE id = ?');

// Build a WHERE clause + params + ORDER BY for a list/search/filter request.
// Throws ValidationError on a bad search query.
function buildListQuery({ q, tag, filterId, view, sort }) {
  const conds = [];
  const params = [];

  if (view === 'archived') {
    conds.push('b.is_archived = 1');
  } else if (view === 'unread') {
    conds.push('b.is_archived = 0', 'b.is_read = 0');
  } else {
    conds.push('b.is_archived = 0');
  }

  const addSearch = (query) => {
    try {
      const { sql, params: p, isEmpty } = buildWhere(query);
      if (!isEmpty) { conds.push(sql); params.push(...p); }
    } catch {
      throw new ValidationError('Your search query could not be understood. Check quotes and parentheses.');
    }
  };

  if (q) addSearch(q);

  if (tag) {
    conds.push(`EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
      WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`);
    params.push(tag);
  }

  if (filterId) {
    const f = getFilterStmt.get(filterId);
    if (f) {
      if (f.query) addSearch(f.query);
      const inc = JSON.parse(f.include_tags || '[]');
      const exc = JSON.parse(f.exclude_tags || '[]');
      for (const t of inc) {
        conds.push(`EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags tg ON tg.id = bt.tag_id
          WHERE bt.bookmark_id = b.id AND tg.name = ? COLLATE NOCASE)`);
        params.push(t);
      }
      for (const t of exc) {
        conds.push(`NOT EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags tg ON tg.id = bt.tag_id
          WHERE bt.bookmark_id = b.id AND tg.name = ? COLLATE NOCASE)`);
        params.push(t);
      }
    }
  }

  const orderBy = SORTS[sort] || SORTS.date_added_desc;
  return { where: conds.join(' AND '), params, orderBy };
}

// GET /api/bookmarks — list/search/sort
router.get('/', (req, res) => {
  const { q, tag, filterId, view, sort } = req.query;
  const { where, params, orderBy } = buildListQuery({ q, tag, filterId, view, sort });
  const rows = db.prepare(`SELECT * FROM bookmarks b WHERE ${where} ORDER BY ${orderBy}`).all(...params);
  res.json({ items: rows.map(serializeBookmark), total: rows.length });
});

// POST /api/bookmarks/preview — fetch details for review before saving
router.post('/preview', asyncHandler(async (req, res) => {
  const normalized = normalize(req.body?.url); // throws ValidationError -> 400
  const existing = findByNormalized(normalized);
  if (existing) {
    return res.json({ duplicate: true, bookmark: serializeBookmark(existing) });
  }
  const meta = await fetchMetadata(normalized);
  res.json({
    duplicate: false,
    url: req.body.url,
    normalized_url: normalized,
    title: meta.title,
    description: meta.description,
    favicon_url: meta.favicon_url,
    preview_image_url: meta.preview_image_url,
    fallback: meta.fallback,
  });
}));

const insertStmt = db.prepare(`
  INSERT INTO bookmarks (url, normalized_url, title, description, favicon_url,
    preview_image_url, saved_date, updated_date, offline_status)
  VALUES (@url, @normalized_url, @title, @description, @favicon_url,
    @preview_image_url, @saved_date, @updated_date, 'pending')
`);
const setOfflineStmt = db.prepare(`
  UPDATE bookmarks SET offline_status=@offline_status, offline_kind=@offline_kind,
    offline_path=@offline_path WHERE id=@id
`);

// Kick off the offline copy asynchronously; never blocks the response.
function startCapture(id, url) {
  captureOffline(id, url)
    .then((r) => setOfflineStmt.run({ id, offline_status: r.offline_status,
      offline_kind: r.offline_kind ?? null, offline_path: r.offline_path ?? null }))
    .catch(() => setOfflineStmt.run({ id, offline_status: 'unavailable',
      offline_kind: null, offline_path: null }));
}

// POST /api/bookmarks — confirm & create from reviewed details
router.post('/', (req, res) => {
  const body = req.body || {};
  const normalized = normalize(body.url); // throws -> 400
  const existing = findByNormalized(normalized);
  if (existing) {
    return res.json({ duplicate: true, bookmark: serializeBookmark(existing) });
  }
  const now = Date.now();
  const title = (body.title && String(body.title).trim()) || deriveTitle(normalized);
  const info = insertStmt.run({
    url: body.url,
    normalized_url: normalized,
    title,
    description: body.description ? String(body.description) : '',
    favicon_url: body.favicon_url || null,
    preview_image_url: body.preview_image_url || null,
    saved_date: now,
    updated_date: now,
  });
  const id = info.lastInsertRowid;
  if (Array.isArray(body.tags) && body.tags.length) setTags(id, body.tags);
  startCapture(id, normalized);
  res.status(201).json(getBookmark(id));
});

// GET /api/bookmarks/:id
router.get('/:id(\\d+)', (req, res) => {
  const bm = getBookmark(Number(req.params.id));
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json(bm);
});

// GET /api/bookmarks/:id/snapshot — serve the stored offline copy
router.get('/:id(\\d+)/snapshot', (req, res) => {
  const row = getBookmarkRow(Number(req.params.id));
  if (!row || row.offline_status !== 'available' || !row.offline_path) {
    return res.status(404).json({ error: 'No offline copy available.' });
  }
  const type = row.offline_kind === 'pdf' ? 'application/pdf' : 'multipart/related';
  res.type(type);
  createReadStream(join(SNAPSHOT_DIR, row.offline_path)).pipe(res);
});

const patchStmt = db.prepare(`
  UPDATE bookmarks SET url=@url, normalized_url=@normalized_url, title=@title,
    description=@description, notes_html=@notes_html, notes_text=@notes_text,
    is_read=@is_read, is_archived=@is_archived, updated_date=@updated_date
  WHERE id=@id
`);

// PATCH /api/bookmarks/:id — partial update
router.patch('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const row = getBookmarkRow(id);
  if (!row) return res.status(404).json({ error: 'Bookmark not found.' });
  const body = req.body || {};

  let url = row.url;
  let normalized = row.normalized_url;
  if (body.url !== undefined) {
    normalized = normalize(body.url); // throws -> 400
    const clash = findByNormalized(normalized);
    if (clash && clash.id !== id) {
      return res.status(409).json({ error: 'Another bookmark already has that address.' });
    }
    url = body.url;
  }

  let notes_html = row.notes_html;
  let notes_text = row.notes_text;
  if (body.notes_html !== undefined) {
    notes_html = sanitizeNotes(body.notes_html);
    notes_text = toPlainText(notes_html);
  }

  patchStmt.run({
    id,
    url,
    normalized_url: normalized,
    title: body.title !== undefined ? String(body.title) : row.title,
    description: body.description !== undefined ? String(body.description) : row.description,
    notes_html,
    notes_text,
    is_read: body.is_read !== undefined ? (body.is_read ? 1 : 0) : row.is_read,
    is_archived: body.is_archived !== undefined ? (body.is_archived ? 1 : 0) : row.is_archived,
    updated_date: Date.now(),
  });

  if (Array.isArray(body.tags)) setTags(id, body.tags);
  res.json(getBookmark(id));
});

const deleteStmt = db.prepare('DELETE FROM bookmarks WHERE id = ?');

// DELETE /api/bookmarks/:id — hard delete (distinct from archive)
router.delete('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const row = getBookmarkRow(id);
  if (!row) return res.status(404).json({ error: 'Bookmark not found.' });
  deleteStmt.run(id);
  res.status(204).end();
});

// POST /api/bookmarks/bulk — apply one action to many
const bulkReadStmt = db.prepare('UPDATE bookmarks SET is_read=?, updated_date=? WHERE id=?');
const bulkArchiveStmt = db.prepare('UPDATE bookmarks SET is_archived=?, updated_date=? WHERE id=?');

router.post('/bulk', (req, res) => {
  const { target, action, tags } = req.body || {};
  let ids = [];
  if (target?.ids && Array.isArray(target.ids)) {
    ids = target.ids.map(Number).filter((n) => Number.isInteger(n));
  } else if (target?.match) {
    const m = target.match;
    const { where, params } = buildListQuery({
      q: m.q, tag: m.tag, filterId: m.filterId, view: m.view, sort: 'date_added_desc',
    });
    ids = db.prepare(`SELECT id FROM bookmarks b WHERE ${where}`).all(...params).map((r) => r.id);
  } else {
    return res.status(400).json({ error: 'A target (ids or match) is required.' });
  }

  const now = Date.now();
  const runAll = transaction((list) => {
    for (const id of list) {
      switch (action) {
        case 'add_tags': if (Array.isArray(tags)) require_addTags(id, tags); break;
        case 'remove_tags': if (Array.isArray(tags)) require_removeTags(id, tags); break;
        case 'mark_read': bulkReadStmt.run(1, now, id); break;
        case 'mark_unread': bulkReadStmt.run(0, now, id); break;
        case 'archive': bulkArchiveStmt.run(1, now, id); break;
        case 'restore': bulkArchiveStmt.run(0, now, id); break;
        case 'delete': deleteStmt.run(id); break;
        default: throw new ValidationError(`Unknown action: ${action}`);
      }
    }
  });
  runAll(ids);
  res.json({ affected: ids.length });
});

// Lazy imports to avoid a circular import at module load with repo tag helpers.
import { addTags as require_addTags, removeTags as require_removeTags } from '../repo.js';
