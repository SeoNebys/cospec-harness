import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchCriteriaSchema } from '../../shared/contracts/search.js';
import { requireUser } from '../auth/auth-plugin.js';
import type { SavedSearchService } from '../domain/saved-search-service.js';

const createSchema = z.object({ name: z.string().trim().min(1).max(120), criteria: searchCriteriaSchema });
const patchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(120).optional(),
  criteria: searchCriteriaSchema.optional(),
});
export async function registerSavedSearchRoutes(
  app: FastifyInstance,
  service: SavedSearchService,
): Promise<void> {
  app.get('/api/saved-searches', async (request) => service.list(requireUser(request).id));
  app.post('/api/saved-searches', async (request, reply) => {
    const body = createSchema.parse(request.body);
    return reply.status(201).send(service.create(requireUser(request).id, body.name, body.criteria));
  });
  app.get<{ Params: { savedSearchId: string } }>('/api/saved-searches/:savedSearchId', async (request) =>
    service.get(requireUser(request).id, request.params.savedSearchId),
  );
  app.patch<{ Params: { savedSearchId: string } }>('/api/saved-searches/:savedSearchId', async (request) => {
    const body = patchSchema.parse(request.body);
    return service.update(
      requireUser(request).id,
      request.params.savedSearchId,
      body.expectedVersion,
      body.name,
      body.criteria,
    );
  });
  app.delete<{ Params: { savedSearchId: string } }>(
    '/api/saved-searches/:savedSearchId',
    async (request, reply) => {
      const body = z.object({ expectedVersion: z.number().int().positive() }).parse(request.body);
      service.delete(requireUser(request).id, request.params.savedSearchId, body.expectedVersion);
      return reply.status(204).send();
    },
  );
}
