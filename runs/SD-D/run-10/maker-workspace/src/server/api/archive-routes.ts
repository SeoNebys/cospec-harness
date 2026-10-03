import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bookmarkStateSchema, permanentDeleteSchema } from '../../shared/contracts/bookmarks.js';
import { requireUser } from '../auth/auth-plugin.js';
import type { ArchiveService } from '../domain/archive-service.js';
import type { BookmarkStateService } from '../domain/bookmark-state-service.js';

export async function registerArchiveRoutes(
  app: FastifyInstance,
  archive: ArchiveService,
  state: BookmarkStateService,
): Promise<void> {
  app.post<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId/archive', async (request) => {
    const body = bookmarkStateSchema.parse(request.body);
    return archive.archive(requireUser(request).id, request.params.bookmarkId, body.expectedVersion);
  });
  app.post<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId/restore', async (request) => {
    const body = bookmarkStateSchema.parse(request.body);
    return archive.restore(requireUser(request).id, request.params.bookmarkId, body.expectedVersion);
  });
  app.delete<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId', async (request, reply) => {
    const body = permanentDeleteSchema.parse(request.body);
    archive.delete(requireUser(request).id, request.params.bookmarkId, body.expectedVersion);
    return reply.status(204).send();
  });
  app.post<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId/reading', async (request) => {
    const body = z
      .object({ expectedVersion: z.number().int().positive(), value: z.enum(['none', 'unread', 'read']) })
      .parse(request.body);
    return state.setReading(
      requireUser(request).id,
      request.params.bookmarkId,
      body.expectedVersion,
      body.value,
    );
  });
  app.post<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId/favorite', async (request) => {
    const body = z
      .object({ expectedVersion: z.number().int().positive(), value: z.boolean() })
      .parse(request.body);
    return state.setFavorite(
      requireUser(request).id,
      request.params.bookmarkId,
      body.expectedVersion,
      body.value,
    );
  });
}
