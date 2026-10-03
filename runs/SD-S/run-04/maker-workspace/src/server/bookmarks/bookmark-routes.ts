import { Router } from 'express';
import { z } from 'zod';
import { bookmarkInputSchema, bookmarkStatusSchema } from '../../shared/contracts/bookmarks.js';
import type { BookmarkRepository } from './bookmark-repository.js';
import type { BookmarkService } from './bookmark-service.js';

const favoriteSchema = z.object({ isFavorite: z.boolean() }).strict();

export function bookmarkRoutes(repository: BookmarkRepository, service: BookmarkService) {
  const router = Router();
  router.get('/', (request, response, next) => {
    try {
      const view = bookmarkStatusSchema.parse(request.query.view ?? 'active');
      const q =
        typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 300) : undefined;
      const rawTags = request.query.tag
        ? Array.isArray(request.query.tag)
          ? request.query.tag
          : [request.query.tag]
        : [];
      const tags = z.array(z.string().uuid()).max(20).parse(rawTags);
      const favorite =
        request.query.favorite === undefined
          ? undefined
          : z.enum(['true', 'false']).parse(request.query.favorite) === 'true';
      const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
      const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
      response.json(
        repository.list(response.locals.user.id, { view, q, tags, favorite, cursor, limit }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post('/', (request, response, next) => {
    try {
      response
        .status(201)
        .json(service.create(response.locals.user.id, bookmarkInputSchema.parse(request.body)));
    } catch (error) {
      next(error);
    }
  });
  router.patch('/:id', (request, response, next) => {
    try {
      response.json(
        service.update(
          response.locals.user.id,
          z.string().uuid().parse(request.params.id),
          bookmarkInputSchema.parse(request.body),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put('/:id/favorite', (request, response, next) => {
    try {
      const { isFavorite } = favoriteSchema.parse(request.body);
      response.json(
        service.favorite(
          response.locals.user.id,
          z.string().uuid().parse(request.params.id),
          isFavorite,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post('/:id/archive', (request, response, next) => {
    try {
      response.json(
        service.status(
          response.locals.user.id,
          z.string().uuid().parse(request.params.id),
          'archived',
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post('/:id/restore', (request, response, next) => {
    try {
      response.json(
        service.status(
          response.locals.user.id,
          z.string().uuid().parse(request.params.id),
          'active',
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.delete('/:id', (request, response, next) => {
    try {
      service.delete(response.locals.user.id, z.string().uuid().parse(request.params.id));
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function tagRoutes(repository: BookmarkRepository) {
  const router = Router();
  router.get('/', (request, response, next) => {
    try {
      const view = bookmarkStatusSchema.parse(request.query.view ?? 'active');
      response.json({ items: repository.tagSummaries(response.locals.user.id, view) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
