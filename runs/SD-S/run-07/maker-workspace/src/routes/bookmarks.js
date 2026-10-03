import { Router } from 'express';
import {
  createBookmark,
  listBookmarks,
  updateBookmark,
  deleteBookmark,
  listTags,
  ValidationError,
  DuplicateError,
  NotFoundError,
} from '../models/bookmark.js';
import { deriveTitle } from '../services/titleFetcher.js';

const router = Router();

// GET /api/bookmarks?q=&tag=  — list newest-first, optional search / tag filter
router.get('/bookmarks', (req, res) => {
  const { q, tag } = req.query;
  const bookmarks = listBookmarks({ q, tag });
  res.json({ bookmarks });
});

// POST /api/bookmarks — create
router.post('/bookmarks', async (req, res, next) => {
  try {
    const { url, title, tags } = req.body || {};
    const bookmark = await createBookmark({ url, title, tags }, deriveTitle);
    res.status(201).json(bookmark);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof DuplicateError) {
      return res.status(409).json({ error: err.message, existingId: err.existingId });
    }
    next(err);
  }
});

// PATCH /api/bookmarks/:id — update title and/or tags
router.patch('/bookmarks/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, tags } = req.body || {};
    const bookmark = updateBookmark(id, { title, tags });
    res.json(bookmark);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/bookmarks/:id
router.delete('/bookmarks/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    deleteBookmark(id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/tags — tag names in use
router.get('/tags', (req, res) => {
  res.json({ tags: listTags() });
});

export default router;
