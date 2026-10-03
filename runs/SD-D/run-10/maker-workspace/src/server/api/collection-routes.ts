import type { FastifyInstance } from 'fastify';
import { requireUser } from '../auth/auth-plugin.js';
import type { OrganizationService } from '../domain/organization-service.js';
import {
  collectionCreateSchema,
  collectionDeleteSchema,
  collectionPatchSchema,
} from '../../shared/contracts/organization.js';

export async function registerCollectionRoutes(
  app: FastifyInstance,
  service: OrganizationService,
): Promise<void> {
  app.get('/api/collections', async (request) => service.listCollections(requireUser(request).id));
  app.post('/api/collections', async (request, reply) =>
    reply
      .status(201)
      .send(
        service.createCollection(requireUser(request).id, collectionCreateSchema.parse(request.body).name),
      ),
  );
  app.patch<{ Params: { collectionId: string } }>('/api/collections/:collectionId', async (request) => {
    const body = collectionPatchSchema.parse(request.body);
    return service.renameCollection(
      requireUser(request).id,
      request.params.collectionId,
      body.expectedVersion,
      body.name,
    );
  });
  app.get<{ Params: { collectionId: string } }>(
    '/api/collections/:collectionId/deletion-impact',
    async (request) => service.collectionImpact(requireUser(request).id, request.params.collectionId),
  );
  app.delete<{ Params: { collectionId: string } }>(
    '/api/collections/:collectionId',
    async (request, reply) => {
      const body = collectionDeleteSchema.parse(request.body);
      service.deleteCollection(
        requireUser(request).id,
        request.params.collectionId,
        body.expectedVersion,
        body.expectedBookmarkCount,
      );
      return reply.status(204).send();
    },
  );
}
