import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { TagService } from '../services/tagService.js';

const querySchema = z.object({ suggest: z.string().max(30), excludeBookmarkId: z.uuid().optional() });
export function tagRoutes(app: FastifyInstance, service: TagService): void {
  app.get('/api/tags', (request) => {
    const query = querySchema.parse(request.query);
    return { items: service.suggest(query.suggest, query.excludeBookmarkId) };
  });
}
