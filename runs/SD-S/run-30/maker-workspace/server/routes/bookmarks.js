import { Router } from 'express';
import db from '../db.js';
import { parseBookmarkUrl } from '../url.js';
import { fetchTitle } from '../title.js';

const router = Router();

// --- Prepared statements ---------------------------------------------------

const stmts = {
  insertBookmark: db.prepare(
    `INSERT INTO bookmarks (url, url_norm, title, note, created_at, updated_at)
     VALUES (@url, @urlNorm, @title, @note, @now, @now)`
  ),
  findByNorm: db.prepare('SELECT id FROM bookmarks WHERE url_norm = ?'),
  findByNormExcluding: db.prepare(
    'SELECT id FROM bookmarks WHERE url_norm = ? AND id != ?'
  ),
  getById: db.prepare('SELECT * FROM bookmarks WHERE id = ?'),
  updateBookmark: db.prepare(
    `UPDATE bookmarks
     SET url = @url, url_norm = @urlNorm, title = @title, note = @note, updated_at = @now
     WHERE id = @id`
  ),
  deleteBookmark: db.prepare('DELETE FROM bookmarks WHERE id = ?'),
  upsertTag: db.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING'),
  getTagId: db.prepare('SELECT id FROM tags WHERE name = ?'),
  linkTag: db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  ),
  clearTags: db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?'),
  tagsForBookmark: db.prepare(
    `SELECT t.name FROM tags t
     JOIN bookmark_tags bt ON bt.tag_id = t.id
     WHERE bt.bookmark_id = ?
     ORDER BY t.name COLLATE NOCASE`
  ),
  distinctTags: db.prepare(
    `SELECT DISTINCT t.name FROM tags t
     JOIN bookmark_tags bt ON bt.tag_id = t.id
     ORDER BY t.name COLLATE NOCASE`
  ),
};

// --- Helpers ---------------------------------------------------------------

function error(res, status, message, extra = {}) {
  return res.status(status).json({ error: message, ...extra });
}

function serialize(row) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    note: row.note,
    tags: stmts.tagsForBookmark.all(row.id).map((r) => r.name),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Normalize an incoming tags value into a clean, de-duplicated list. */
function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Map(); // lowercased -> original trimmed
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (name === '') continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}

/** Replace a bookmark's tags with the given clean list (within a transaction). */
const setTags = db.transaction((bookmarkId, tags) => {
  stmts.clearTags.run(bookmarkId);
  for (const name of tags) {
    stmts.upsertTag.run(name);
    const { id } = stmts.getTagId.get(name);
    stmts.linkTag.run(bookmarkId, id);
  }
});

// --- Routes ----------------------------------------------------------------

// GET /api/bookmarks?search=&tag=  -> list, newest first (FR-006, FR-007, FR-008)
router.get('/bookmarks', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';

  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(b.title LIKE ? OR b.url LIKE ? OR b.note LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (tag) {
    clauses.push(
      `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt
                JOIN tags t ON t.id = bt.tag_id
                WHERE t.name = ? COLLATE NOCASE)`
    );
    params.push(tag);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`)
    .all(...params);

  res.json({ bookmarks: rows.map(serialize) });
});

// GET /api/tags -> distinct in-use tag names (FR-008)
router.get('/tags', (_req, res) => {
  res.json({ tags: stmts.distinctTags.all().map((r) => r.name) });
});

// GET /api/bookmarks/:id
router.get('/bookmarks/:id', (req, res) => {
  const row = stmts.getById.get(req.params.id);
  if (!row) return error(res, 404, 'Bookmark not found.');
  res.json(serialize(row));
});

// POST /api/bookmarks -> create (FR-001..005, FR-013)
router.post('/bookmarks', async (req, res) => {
  const body = req.body || {};
  const parsed = parseBookmarkUrl(body.url);
  if (!parsed.ok) return error(res, 400, parsed.error);

  const existing = stmts.findByNorm.get(parsed.urlNorm);
  if (existing) {
    return error(res, 409, 'This address is already saved.', { existingId: existing.id });
  }

  let title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    title = (await fetchTitle(parsed.url)) || parsed.url; // best-effort (FR-003)
  }
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const tags = cleanTags(body.tags);
  const now = new Date().toISOString();

  const result = stmts.insertBookmark.run({
    url: parsed.url,
    urlNorm: parsed.urlNorm,
    title,
    note,
    now,
  });
  const id = Number(result.lastInsertRowid);
  if (tags.length) setTags(id, tags);

  res.status(201).json(serialize(stmts.getById.get(id)));
});

// PUT /api/bookmarks/:id -> edit (FR-010)
router.put('/bookmarks/:id', async (req, res) => {
  const current = stmts.getById.get(req.params.id);
  if (!current) return error(res, 404, 'Bookmark not found.');

  const body = req.body || {};
  const parsed = parseBookmarkUrl(body.url ?? current.url);
  if (!parsed.ok) return error(res, 400, parsed.error);

  const clash = stmts.findByNormExcluding.get(parsed.urlNorm, current.id);
  if (clash) {
    return error(res, 409, 'This address is already saved.', { existingId: clash.id });
  }

  let title = typeof body.title === 'string' ? body.title.trim() : current.title;
  if (!title) title = parsed.url;
  const note = typeof body.note === 'string' ? body.note.trim() : current.note;
  const now = new Date().toISOString();

  stmts.updateBookmark.run({
    id: current.id,
    url: parsed.url,
    urlNorm: parsed.urlNorm,
    title,
    note,
    now,
  });
  if (body.tags !== undefined) setTags(current.id, cleanTags(body.tags));

  res.json(serialize(stmts.getById.get(current.id)));
});

// DELETE /api/bookmarks/:id -> remove (FR-011)
router.delete('/bookmarks/:id', (req, res) => {
  const info = stmts.deleteBookmark.run(req.params.id);
  if (info.changes === 0) return error(res, 404, 'Bookmark not found.');
  res.status(204).end();
});

export default router;
