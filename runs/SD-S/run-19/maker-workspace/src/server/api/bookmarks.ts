import { Router } from 'express';
import { bookmarkIdSchema, bookmarkQuerySchema, createBookmarkSchema, updateBookmarkSchema } from '../../shared/schemas.js';
import { BookmarkNotFoundError, BookmarkRepository, DuplicateBookmarkError } from '../db/bookmark-repository.js';

function duplicateResponse(error: DuplicateBookmarkError) {
  return {
    error: { code: 'DUPLICATE_URL', message: error.message, field: 'url' },
    duplicates: error.duplicates,
  };
}

export function createBookmarksRouter(repository: BookmarkRepository): Router {
  const router = Router();

  router.get('/', (request, response) => {
    const query = bookmarkQuerySchema.parse(request.query);
    const items = repository.list({ query: query.q, tag: query.tag });
    response.json({ items, total: items.length });
  });

  router.post('/', (request, response) => {
    try {
      const created = repository.create(createBookmarkSchema.parse(request.body));
      response.status(201).json(created);
    } catch (error) {
      if (error instanceof DuplicateBookmarkError) {
        response.status(409).json(duplicateResponse(error));
        return;
      }
      throw error;
    }
  });

  router.patch('/:bookmarkId', (request, response) => {
    try {
      const id = bookmarkIdSchema.parse(request.params.bookmarkId);
      response.json(repository.update(id, updateBookmarkSchema.parse(request.body)));
    } catch (error) {
      if (error instanceof DuplicateBookmarkError) {
        response.status(409).json(duplicateResponse(error));
        return;
      }
      if (error instanceof BookmarkNotFoundError) {
        response.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
        return;
      }
      throw error;
    }
  });

  router.delete('/:bookmarkId', (request, response) => {
    const id = bookmarkIdSchema.parse(request.params.bookmarkId);
    if (!repository.delete(id)) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'That bookmark no longer exists.' } });
      return;
    }
    response.status(204).end();
  });

  return router;
}
