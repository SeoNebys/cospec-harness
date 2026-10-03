import { Router } from 'express';

import {
  bookmarkIdSchema,
  bookmarkQuerySchema,
  createBookmarkSchema,
  updateBookmarkSchema,
} from '../../shared/bookmark-schema.js';
import type { BookmarkDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import { BookmarkRepository } from '../repositories/bookmark-repository.js';

const parseQuery = (query: Record<string, unknown>) => {
  const result = bookmarkQuerySchema.safeParse(query);
  if (!result.success) {
    throw new AppError(400, 'INVALID_QUERY', 'Check the search and filter values.');
  }
  return result.data;
};

export function createBookmarksRouter(db: BookmarkDatabase): Router {
  const router = Router();
  const repository = new BookmarkRepository(db);

  router.get('/', (request, response) => {
    response.json(repository.list(parseQuery(request.query)));
  });

  router.get('/:bookmarkId', (request, response) => {
    response.json(repository.get(bookmarkIdSchema.parse(request.params.bookmarkId)));
  });

  router.post('/', (request, response) => {
    response.status(201).json(repository.create(createBookmarkSchema.parse(request.body)));
  });

  router.patch('/:bookmarkId', (request, response) => {
    const id = bookmarkIdSchema.parse(request.params.bookmarkId);
    response.json(repository.update(id, updateBookmarkSchema.parse(request.body)));
  });

  router.delete('/:bookmarkId', (request, response) => {
    repository.delete(bookmarkIdSchema.parse(request.params.bookmarkId));
    response.status(204).end();
  });

  return router;
}
