import { Router } from 'express';
import { listTags } from '../services/bookmarks.js';

export function tagsRouter() {
  const router = Router();
  router.get('/', (req, res) => {
    res.json(listTags(req.query.prefix));
  });
  return router;
}
