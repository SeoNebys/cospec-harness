import express from 'express';
import {
  saveBookmark,
  getBookmark,
  updateBookmark,
  deleteBookmark,
  listBookmarks,
} from '../services/bookmarks.js';
import { renderNote } from '../services/markdown.js';
import { applyBulk } from '../services/bulk.js';

export const bookmarksRouter = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/bookmarks — save (dedup opens existing)
bookmarksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { address, title, description, note, tags } = req.body || {};
    const { bookmark, existing } = await saveBookmark({ address, title, description, note, tags });
    res.status(existing ? 200 : 201).json({ bookmark, existing });
  })
);

// GET /api/bookmarks — list
bookmarksRouter.get('/', (req, res) => {
  const { sort = 'newest', view = 'normal', tag, limit, offset } = req.query;
  const result = listBookmarks({
    sort,
    view,
    tag: tag || null,
    limit: limit != null ? Number(limit) : null,
    offset: offset != null ? Number(offset) : 0,
  });
  res.json(result);
});

// POST /api/bookmarks/bulk — apply an action to many (US7)
bookmarksRouter.post('/bulk', (req, res) => {
  const affected = applyBulk(req.body || {});
  res.json({ affected });
});

// GET /api/bookmarks/:id — one bookmark (with rendered note)
bookmarksRouter.get('/:id', (req, res) => {
  const bookmark = getBookmark(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found.' } });
  return res.json({ bookmark, noteHtml: renderNote(bookmark.note) });
});

// PATCH /api/bookmarks/:id — edit
bookmarksRouter.patch('/:id', (req, res) => {
  const bookmark = updateBookmark(Number(req.params.id), req.body || {});
  res.json({ bookmark });
});

// DELETE /api/bookmarks/:id — delete (confirmation required)
bookmarksRouter.delete('/:id', (req, res) => {
  if (req.query.confirm !== 'true') {
    return res.status(400).json({ error: { code: 'confirm_required', message: 'Deletion must be confirmed.' } });
  }
  const ok = deleteBookmark(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found.' } });
  return res.status(204).end();
});
