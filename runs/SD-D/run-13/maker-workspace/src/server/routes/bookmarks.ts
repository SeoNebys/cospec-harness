import type { FastifyPluginAsync } from 'fastify';
import { BookmarkService } from '../services/bookmark-service.js';
import { CollectionQueryService } from '../services/collection-query-service.js';

export const bookmarkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/bookmarks', async (request) => new CollectionQueryService(app.db).list(request.query as any));
  app.post('/api/bookmarks', async (request, reply) => {
    const bookmark = new BookmarkService(app.db).create((request.body || {}) as any);
    return reply.status(201).header('Location',`/api/bookmarks/${bookmark.id}`).send(bookmark);
  });
  app.get('/api/bookmarks/:bookmarkId', async (request) => new BookmarkService(app.db).get((request.params as any).bookmarkId));
  app.patch('/api/bookmarks/:bookmarkId', async (request) => new BookmarkService(app.db).update((request.params as any).bookmarkId,(request.body || {}) as any));
  app.delete('/api/bookmarks/:bookmarkId', async (request,reply) => { new BookmarkService(app.db).delete((request.params as any).bookmarkId); return reply.status(204).send(); });
  app.post('/api/bookmarks/:bookmarkId/archive', async (request) => new BookmarkService(app.db).archive((request.params as any).bookmarkId));
  app.post('/api/bookmarks/:bookmarkId/restore', async (request) => new BookmarkService(app.db).restore((request.params as any).bookmarkId));
};
