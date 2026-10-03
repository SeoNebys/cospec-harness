import { Router } from 'express';

import type { BookmarkDatabase } from '../db/database.js';
import { createBookmarksRouter } from './bookmarks.js';
import { createTagsRouter } from './tags.js';

export function createApiRouter(db: BookmarkDatabase): Router {
  const router = Router();
  router.get('/health', (_request, response) => response.json({ status: 'ok' }));
  router.use('/bookmarks', createBookmarksRouter(db));
  router.use('/tags', createTagsRouter(db));
  return router;
}
