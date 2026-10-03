import { Router } from 'express';
import * as service from '../services/bookmarks.js';

// REST endpoints for bookmarks. See specs/001-bookmark-manager/contracts/api.md.

const router = Router();

function parseId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/bookmarks?q=&tag=
router.get('/bookmarks', (req, res, next) => {
  try {
    const bookmarks = service.listBookmarks({ q: req.query.q, tag: req.query.tag });
    res.json({ bookmarks });
  } catch (err) {
    next(err);
  }
});

// GET /api/tags
router.get('/tags', (req, res, next) => {
  try {
    res.json({ tags: service.listTags() });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookmarks
router.post('/bookmarks', async (req, res, next) => {
  try {
    const { bookmark, warnings } = await service.createBookmark(req.body || {});
    const body = { bookmark };
    if (warnings.length) body.warnings = warnings;
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookmarks/:id
router.get('/bookmarks/:id', (req, res, next) => {
  try {
    const id = parseId(req);
    if (id === null) return next(notFound());
    res.json({ bookmark: service.getBookmark(id) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/bookmarks/:id
router.put('/bookmarks/:id', (req, res, next) => {
  try {
    const id = parseId(req);
    if (id === null) return next(notFound());
    res.json({ bookmark: service.updateBookmark(id, req.body || {}) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bookmarks/:id
router.delete('/bookmarks/:id', (req, res, next) => {
  try {
    const id = parseId(req);
    if (id === null) return next(notFound());
    service.deleteBookmark(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

function notFound() {
  const err = new service.ServiceError('not_found', 'Bookmark not found.', 404);
  return err;
}

export default router;
