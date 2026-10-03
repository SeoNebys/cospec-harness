import { Router } from 'express';
import type { BookmarkRepository } from '../db/bookmark-repository.js';

export function createTagsRouter(repository: BookmarkRepository): Router {
  const router = Router();
  router.get('/', (_request, response) => response.json({ items: repository.listTags() }));
  return router;
}
