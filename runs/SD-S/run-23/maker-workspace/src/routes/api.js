import { Router } from 'express';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../bookmarks.js';

export function createApiRouter(store) {
  const router = Router();

  router.get('/bookmarks', (req, res) => {
    const bookmarks = store.list({ q: req.query.q, tag: req.query.tag });
    res.json({ bookmarks, total: bookmarks.length });
  });

  router.post('/bookmarks', async (req, res, next) => {
    try {
      const { url, tags, title, description, faviconUrl } = req.body || {};
      const { bookmark, existed } = await store.create({
        url,
        tags,
        title,
        description,
        faviconUrl,
      });
      res.status(existed ? 200 : 201).json({ bookmark, existed });
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  });

  router.get('/bookmarks/:id', (req, res) => {
    const bookmark = store.getById(Number(req.params.id));
    if (!bookmark) return res.status(404).json({ error: 'Not found' });
    res.json({ bookmark });
  });

  router.patch('/bookmarks/:id', (req, res) => {
    try {
      const bookmark = store.update(Number(req.params.id), req.body || {});
      res.json({ bookmark });
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof ConflictError) {
        return res.status(409).json({ error: err.message, id: err.existingId });
      }
      throw err;
    }
  });

  router.delete('/bookmarks/:id', (req, res) => {
    try {
      store.remove(Number(req.params.id));
      res.status(204).end();
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }
  });

  router.get('/tags', (req, res) => {
    res.json({ tags: store.listTags() });
  });

  return router;
}
