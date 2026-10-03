import { Router } from 'express';
import { bookmarkIdSchema, createBookmarkSchema, listCriteriaSchema, updateBookmarkSchema } from '../../shared/bookmark-schemas.js';
import type { BookmarkService } from '../services/bookmark-service.js';

export function createBookmarkRouter(service: BookmarkService): Router {
  const router = Router();

  router.get('/bookmarks', (request, response) => {
    response.json(service.list(listCriteriaSchema.parse(request.query)));
  });

  router.post('/bookmarks', (request, response) => {
    response.status(201).json({ bookmark: service.create(createBookmarkSchema.parse(request.body)) });
  });

  router.patch('/bookmarks/:bookmarkId', (request, response) => {
    const id = bookmarkIdSchema.parse(request.params.bookmarkId);
    response.json({ bookmark: service.update(id, updateBookmarkSchema.parse(request.body)) });
  });

  router.post('/bookmarks/:bookmarkId/archive', (request, response) => {
    const id = bookmarkIdSchema.parse(request.params.bookmarkId);
    response.json({ bookmark: service.archive(id) });
  });

  router.post('/bookmarks/:bookmarkId/restore', (request, response) => {
    const id = bookmarkIdSchema.parse(request.params.bookmarkId);
    response.json({ bookmark: service.restore(id) });
  });

  router.delete('/bookmarks/:bookmarkId', (request, response) => {
    const id = bookmarkIdSchema.parse(request.params.bookmarkId);
    service.delete(id);
    response.status(204).end();
  });

  return router;
}
