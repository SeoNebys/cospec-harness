import { Router } from 'express';
import {
  BookmarkStore,
  DuplicateAddressError,
  NotFoundError,
} from '../models/bookmarks.js';
import { InvalidUrlError } from '../services/url.js';

export function createRouter(db) {
  const store = new BookmarkStore(db);
  const router = Router();

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof DuplicateAddressError) {
        res.status(409).json({
          error: err.message,
          existingId: err.existingId,
          existingArchived: err.existingArchived,
        });
      } else if (err instanceof InvalidUrlError) {
        res.status(400).json({ error: err.message });
      } else if (err instanceof NotFoundError) {
        res.status(404).json({ error: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong.' });
      }
    }
  };

  router.get(
    '/bookmarks',
    handle((req, res) => {
      const { view = 'active', q = '', tag = '' } = req.query;
      res.json(store.list({ view, q, tag }));
    })
  );

  router.get(
    '/bookmarks/:id',
    handle((req, res) => {
      res.json(store.get(Number(req.params.id)));
    })
  );

  router.post(
    '/bookmarks',
    handle(async (req, res) => {
      const created = await store.create(req.body || {});
      res.status(201).json(created);
    })
  );

  router.patch(
    '/bookmarks/:id',
    handle((req, res) => {
      res.json(store.update(Number(req.params.id), req.body || {}));
    })
  );

  router.delete(
    '/bookmarks/:id',
    handle((req, res) => {
      store.remove(Number(req.params.id));
      res.status(204).end();
    })
  );

  router.get(
    '/tags',
    handle((req, res) => {
      res.json(store.allTags());
    })
  );

  return router;
}
