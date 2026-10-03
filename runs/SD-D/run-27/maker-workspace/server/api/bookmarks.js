import express from 'express';
import { db } from '../db/db.js';
import { canonicalKey, isValidHttpUrl, titleFromUrl } from '../lib/urlNormalize.js';
import { parseQuery, compileToSql, QueryError } from '../lib/queryParser.js';
import { fetchMetadata } from '../lib/metadata.js';
import { renderNote } from '../notes/render.js';
import { getBookmarkTags, setBookmarkTags } from './tags.js';

export const router = express.Router();

const SORTS = {
  date_added: 'b.created_at DESC',
  title: 'lower(b.title) ASC',
  last_updated: 'b.updated_at DESC'
};

function shape(row) {
  if (!row) return null;
  return {
    ...row,
    read_later: !!row.read_later,
    is_read: !!row.is_read,
    is_archived: !!row.is_archived,
    tags: getBookmarkTags(row.id)
  };
}

// Build WHERE clause + params from a selection/view spec. Throws QueryError on bad q.
function buildFilter({ view, q, include_tags, exclude_tags }) {
  const clauses = [];
  const params = [];

  // View
  if (view === 'read_later') {
    clauses.push('b.read_later = 1 AND b.is_archived = 0');
  } else if (view === 'archive') {
    clauses.push('b.is_archived = 1');
  } else {
    clauses.push('b.is_archived = 0'); // main
  }

  // Search query
  if (q && q.trim()) {
    const ast = parseQuery(q);
    if (ast) {
      const { sql, params: qp } = compileToSql(ast);
      clauses.push(sql);
      params.push(...qp);
    }
  }

  // Included tags (all must be present)
  const inc = parseTagList(include_tags);
  for (const t of inc) {
    clauses.push(
      'b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE lower(t.name) = lower(?))'
    );
    params.push(t);
  }
  // Excluded tags (none may be present)
  const exc = parseTagList(exclude_tags);
  for (const t of exc) {
    clauses.push(
      'b.id NOT IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE lower(t.name) = lower(?))'
    );
    params.push(t);
  }

  return { where: clauses.join(' AND '), params };
}

function parseTagList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

// GET /api/bookmarks  (list + search + sort + pagination)
router.get('/', (req, res, next) => {
  try {
    const { view = 'main', q, include_tags, exclude_tags } = req.query;
    let sort = SORTS[req.query.sort] || SORTS.date_added;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(req.query.page_size, 10) || 25));

    const { where, params } = buildFilter({ view, q, include_tags, exclude_tags });
    const total = db.prepare(`SELECT COUNT(*) AS c FROM bookmarks b WHERE ${where}`).get(...params).c;
    const rows = db
      .prepare(`SELECT b.* FROM bookmarks b WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize);
    res.json({ items: rows.map(shape), total, page, page_size: pageSize });
  } catch (err) {
    if (err instanceof QueryError) return res.status(400).json({ error: { code: 'bad_query', message: err.message } });
    next(err);
  }
});

// POST /api/bookmarks/preview  (fetch metadata for review WITHOUT creating)
router.post('/preview', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (!isValidHttpUrl(url)) {
      return res.status(400).json({ error: { code: 'invalid_url', message: 'A valid http(s) URL is required' } });
    }
    const key = canonicalKey(url);
    const existing = db.prepare('SELECT * FROM bookmarks WHERE url_key = ?').get(key);
    if (existing) {
      return res.status(200).json({ duplicate: true, bookmark: shape(existing) });
    }
    const meta = await fetchMetadata(url);
    res.json({
      duplicate: false,
      metadata: {
        title: meta.title || titleFromUrl(url),
        description: meta.description || '',
        icon_url: meta.icon_url || null,
        preview_image_url: meta.preview_image_url || null,
        metadata_status: meta.status || 'ok'
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookmarks  (create with metadata, or resolve duplicate)
router.post('/', async (req, res, next) => {
  try {
    const { url, title, description, note, tags, icon_url, preview_image_url, metadata_status } = req.body || {};
    if (!isValidHttpUrl(url)) {
      return res.status(400).json({ error: { code: 'invalid_url', message: 'A valid http(s) URL is required' } });
    }
    const key = canonicalKey(url);
    const existing = db.prepare('SELECT * FROM bookmarks WHERE url_key = ?').get(key);
    if (existing) {
      return res.status(200).json({ bookmark: shape(existing), duplicate: true });
    }

    // Reuse metadata already fetched at the preview step when provided; otherwise fetch now.
    const prefetched = icon_url !== undefined || preview_image_url !== undefined || metadata_status !== undefined;
    const meta = prefetched
      ? { status: metadata_status || 'ok', icon_url: icon_url || null, preview_image_url: preview_image_url || null, title: null, description: null }
      : await fetchMetadata(url);
    const now = Date.now();
    const finalTitle = (title && title.trim()) || meta.title || titleFromUrl(url);
    const finalDesc = description != null ? description : (meta.description || null);
    const info = db
      .prepare(
        `INSERT INTO bookmarks (url, url_key, title, description, note, icon_url, preview_image_url, created_at, updated_at, metadata_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(url.trim(), key, finalTitle, finalDesc, note || null, meta.icon_url || null, meta.preview_image_url || null, now, now, meta.status || 'ok');
    if (Array.isArray(tags)) setBookmarkTags(info.lastInsertRowid, tags);
    const created = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ bookmark: shape(created), duplicate: false });
  } catch (err) {
    next(err);
  }
});

// Bulk actions  POST /api/bookmarks/bulk
router.post('/bulk', (req, res, next) => {
  try {
    const { ids, selection, action, params: aParams } = req.body || {};
    let targetIds = [];
    if (Array.isArray(ids) && ids.length) {
      targetIds = ids.map(Number).filter(Number.isInteger);
    } else if (selection) {
      const { where, params } = buildFilter(selection);
      targetIds = db.prepare(`SELECT b.id FROM bookmarks b WHERE ${where}`).all(...params).map(r => r.id);
    }
    if (!targetIds.length) return res.json({ affected: 0 });

    const run = db.transaction(() => {
      let affected = 0;
      const now = Date.now();
      for (const id of targetIds) {
        switch (action) {
          case 'add_tags': {
            const current = getBookmarkTags(id);
            const merged = [...new Set([...current, ...(aParams?.tags || [])])];
            setBookmarkTags(id, merged);
            db.prepare('UPDATE bookmarks SET updated_at = ? WHERE id = ?').run(now, id);
            affected++;
            break;
          }
          case 'remove_tags': {
            const current = getBookmarkTags(id);
            const remove = new Set((aParams?.tags || []).map(t => t.toLowerCase()));
            setBookmarkTags(id, current.filter(t => !remove.has(t.toLowerCase())));
            db.prepare('UPDATE bookmarks SET updated_at = ? WHERE id = ?').run(now, id);
            affected++;
            break;
          }
          case 'archive':
            db.prepare('UPDATE bookmarks SET is_archived = 1, updated_at = ? WHERE id = ?').run(now, id); affected++; break;
          case 'unarchive':
            db.prepare('UPDATE bookmarks SET is_archived = 0, updated_at = ? WHERE id = ?').run(now, id); affected++; break;
          case 'mark_read':
            db.prepare('UPDATE bookmarks SET is_read = 1, updated_at = ? WHERE id = ?').run(now, id); affected++; break;
          case 'mark_unread':
            db.prepare('UPDATE bookmarks SET is_read = 0, updated_at = ? WHERE id = ?').run(now, id); affected++; break;
          case 'delete':
            db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id); affected++; break;
          default:
            throw new QueryError('Unknown bulk action');
        }
      }
      return affected;
    });
    const affected = run();
    res.json({ affected });
  } catch (err) {
    if (err instanceof QueryError) return res.status(400).json({ error: { code: 'bad_request', message: err.message } });
    next(err);
  }
});

// GET /api/bookmarks/:id  (detail with rendered note)
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  const preserved = db.prepare('SELECT * FROM preserved_copies WHERE bookmark_id = ? ORDER BY created_at DESC').all(row.id);
  res.json({ bookmark: { ...shape(row), note_html: renderNote(row.note), preserved } });
});

// PATCH /api/bookmarks/:id
router.patch('/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
    const b = req.body || {};
    const updates = {};

    if (b.url !== undefined) {
      if (!isValidHttpUrl(b.url)) return res.status(400).json({ error: { code: 'invalid_url', message: 'A valid http(s) URL is required' } });
      const key = canonicalKey(b.url);
      const collision = db.prepare('SELECT id FROM bookmarks WHERE url_key = ? AND id != ?').get(key, row.id);
      if (collision) return res.status(409).json({ error: { code: 'duplicate_url', message: 'Another bookmark already has this address' }, existingId: collision.id });
      updates.url = b.url.trim();
      updates.url_key = key;
    }
    for (const f of ['title', 'description', 'note', 'icon_url', 'preview_image_url']) {
      if (b[f] !== undefined) updates[f] = b[f];
    }
    for (const f of ['read_later', 'is_read', 'is_archived']) {
      if (b[f] !== undefined) updates[f] = b[f] ? 1 : 0;
    }
    updates.updated_at = Date.now();

    const keys = Object.keys(updates);
    if (keys.length) {
      const setSql = keys.map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE bookmarks SET ${setSql} WHERE id = ?`).run(...keys.map(k => updates[k]), row.id);
    }
    if (b.tags !== undefined) setBookmarkTags(row.id, b.tags);

    const updated = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(row.id);
    res.json({ bookmark: { ...shape(updated), note_html: renderNote(updated.note) } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bookmarks/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  res.json({ deleted: true });
});

// POST /api/bookmarks/:id/retry-metadata
router.post('/:id/retry-metadata', async (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
    const meta = await fetchMetadata(row.url);
    db.prepare(
      `UPDATE bookmarks SET title = ?, description = ?, icon_url = ?, preview_image_url = ?, metadata_status = ?, updated_at = ? WHERE id = ?`
    ).run(
      meta.title || row.title,
      meta.description || row.description,
      meta.icon_url || row.icon_url,
      meta.preview_image_url || row.preview_image_url,
      meta.status || row.metadata_status,
      Date.now(),
      row.id
    );
    const updated = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(row.id);
    res.json({ bookmark: shape(updated) });
  } catch (err) {
    next(err);
  }
});

export { buildFilter };
