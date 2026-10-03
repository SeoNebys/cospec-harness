// /api/bookmarks routes (contracts/api.md).
import { Router } from 'express';

export function bookmarksRouter(repo) {
  const router = Router();

  // GET /api/bookmarks?q=&tag=&tag=
  router.get('/', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const tag = req.query.tag;
    const tags = Array.isArray(tag) ? tag : tag ? [tag] : [];
    res.json({ bookmarks: repo.list({ q, tags }) });
  });

  // POST /api/bookmarks
  router.post('/', async (req, res, next) => {
    try {
      const { url, title, tags } = req.body ?? {};
      const bookmark = await repo.create({ url, title, tags });
      res.status(201).json({ bookmark });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/bookmarks/:id
  router.get('/:id', (req, res, next) => {
    const bookmark = repo.getById(Number(req.params.id));
    if (!bookmark) return next(Object.assign(new Error('Bookmark not found.'), { code: 'not_found' }));
    res.json({ bookmark });
  });

  // PUT /api/bookmarks/:id
  router.put('/:id', async (req, res, next) => {
    try {
      const { url, title, tags } = req.body ?? {};
      const bookmark = await repo.update(Number(req.params.id), { url, title, tags });
      res.json({ bookmark });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/bookmarks/:id
  router.delete('/:id', (req, res, next) => {
    try {
      repo.remove(Number(req.params.id));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
