import type { FastifyInstance } from 'fastify';
import {
  createBookmarkSchema,
  listBookmarksQuerySchema,
  updateBookmarkSchema,
} from '../../shared/schemas/api.js';
import type { BookmarkRepository } from '../repositories/bookmarkRepository.js';
import type { BookmarkService } from '../services/bookmarkService.js';

export function bookmarkRoutes(
  app: FastifyInstance,
  service: BookmarkService,
  repository: BookmarkRepository,
): void {
  app.get('/api/bookmarks', (request) => repository.list(listBookmarksQuerySchema.parse(request.query)));
  app.post('/api/bookmarks', (request, reply) =>
    reply.status(201).send(service.create(createBookmarkSchema.parse(request.body))),
  );
  app.get('/api/bookmarks/:bookmarkId', (request) =>
    service.get((request.params as { bookmarkId: string }).bookmarkId),
  );
  app.patch('/api/bookmarks/:bookmarkId', (request) =>
    service.update(
      (request.params as { bookmarkId: string }).bookmarkId,
      updateBookmarkSchema.parse(request.body),
    ),
  );
}
