import { Router } from 'express';
import {
  createBookmark,
  listBookmarks,
  listTags,
  updateBookmark,
  deleteBookmark,
  ValidationError,
  NotFoundError,
} from './bookmarks.js';

export const router = Router();

// GET /api/bookmarks?q=&tag= — list newest-first with optional filters.
router.get('/bookmarks', (req, res) => {
  const { q, tag } = req.query;
  const { bookmarks, total } = listBookmarks({ q, tag });
  res.json({ bookmarks, total });
});

// GET /api/tags — distinct sorted tags for the filter control.
router.get('/tags', (_req, res) => {
  res.json({ tags: listTags() });
});

// POST /api/bookmarks — create; 201 with { bookmark, warning? }.
router.post('/bookmarks', (req, res, next) => {
  try {
    const result = createBookmark(req.body ?? {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/bookmarks/:id — partial update; 200 with { bookmark }.
router.put('/bookmarks/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const bookmark = updateBookmark(id, req.body ?? {});
    res.json({ bookmark });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bookmarks/:id — 204 on success.
router.delete('/bookmarks/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    deleteBookmark(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Route-level error translation to the { error, message } contract shape.
router.use((err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.code, message: err.message });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.code, message: err.message });
  }
  return res
    .status(500)
    .json({ error: 'internal_error', message: 'Something went wrong.' });
});
