import type { FastifyInstance } from 'fastify';
import { bookmarkCreateSchema, bookmarkPatchSchema } from '../../shared/contracts/bookmarks.js';
import { bookmarkListQuerySchema, listQueryToCriteria } from '../../shared/contracts/search.js';
import { requireUser } from '../auth/auth-plugin.js';
import type { BookmarkService } from '../domain/bookmark-service.js';
import type { SearchRepository } from '../repositories/search-repository.js';
import { SearchSyntaxError } from '../search/lexer.js';
import { AppError } from './errors.js';

export async function registerBookmarkRoutes(
  app: FastifyInstance,
  dependencies: { bookmarks: BookmarkService; search: SearchRepository },
): Promise<void> {
  const { bookmarks: service, search } = dependencies;
  app.get('/api/bookmarks', async (request) => {
    const user = requireUser(request);
    const query = bookmarkListQuerySchema.parse(request.query);
    try {
      return search.search(user.id, listQueryToCriteria(query), query.limit, query.cursor);
    } catch (error) {
      if (error instanceof SearchSyntaxError) {
        throw new AppError(422, 'invalid_search', error.message, {
          errors: [
            {
              field: 'query',
              code: error.code,
              start: error.start,
              end: error.end,
              suggestion: error.suggestion,
            },
          ],
          query: query.query,
        });
      }
      throw error;
    }
  });

  app.post('/api/bookmarks', async (request, reply) => {
    const result = await service.create(requireUser(request).id, bookmarkCreateSchema.parse(request.body));
    return reply.status(201).send(result);
  });

  app.get<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId', async (request) =>
    service.get(requireUser(request).id, request.params.bookmarkId),
  );

  app.patch<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId', async (request) =>
    service.update(
      requireUser(request).id,
      request.params.bookmarkId,
      bookmarkPatchSchema.parse(request.body),
    ),
  );
}
