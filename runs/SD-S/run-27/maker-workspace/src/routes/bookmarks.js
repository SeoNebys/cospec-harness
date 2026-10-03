import { Router } from 'express';
import {
  createBookmark,
  getBookmarkById,
  listBookmarks,
  listTags,
  updateBookmark,
  deleteBookmark,
  ValidationError,
  NotFoundError,
} from '../repository.js';

const router = Router();

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    throw err;
  }
}

router.get('/bookmarks', (req, res) => {
  const { q, tag } = req.query;
  const bookmarks = listBookmarks({ q, tag });
  res.json({ bookmarks });
});

router.get('/tags', (req, res) => {
  res.json({ tags: listTags() });
});

router.post('/bookmarks', (req, res) => {
  handle(res, () => {
    const { bookmark, duplicateOf } = createBookmark(req.body || {});
    res.status(201).json({ bookmark, duplicateOf });
  });
});

router.get('/bookmarks/:id', (req, res) => {
  const bookmark = getBookmarkById(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json({ bookmark });
});

router.put('/bookmarks/:id', (req, res) => {
  handle(res, () => {
    const bookmark = updateBookmark(Number(req.params.id), req.body || {});
    res.json({ bookmark });
  });
});

router.delete('/bookmarks/:id', (req, res) => {
  handle(res, () => {
    deleteBookmark(Number(req.params.id));
    res.status(204).end();
  });
});

export default router;
