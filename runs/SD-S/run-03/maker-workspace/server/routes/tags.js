// /api/tags route (contracts/api.md).
import { Router } from 'express';

export function tagsRouter(repo) {
  const router = Router();

  // GET /api/tags -> { tags: [{ name, count }] }
  router.get('/', (_req, res) => {
    res.json({ tags: repo.listTags() });
  });

  return router;
}
