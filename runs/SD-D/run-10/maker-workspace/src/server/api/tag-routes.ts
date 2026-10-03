import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/auth-plugin.js';
import type { OrganizationService } from '../domain/organization-service.js';
import {
  tagCreateSchema,
  tagDeleteSchema,
  tagMergeSchema,
  tagPatchSchema,
} from '../../shared/contracts/organization.js';

export async function registerTagRoutes(app: FastifyInstance, service: OrganizationService): Promise<void> {
  app.get('/api/tags', async (request) => {
    const query = z
      .object({ suggest: z.string().default(''), limit: z.coerce.number().int().min(1).max(50).default(50) })
      .parse(request.query);
    return service.listTags(requireUser(request).id, query.suggest, query.limit);
  });
  app.post('/api/tags', async (request, reply) => {
    const result = service.createTag(requireUser(request).id, tagCreateSchema.parse(request.body).name);
    return reply.status(result.status).send({ ...result.tag, created: result.created });
  });
  app.patch<{ Params: { tagId: string } }>('/api/tags/:tagId', async (request) => {
    const body = tagPatchSchema.parse(request.body);
    return service.renameTag(requireUser(request).id, request.params.tagId, body.expectedVersion, body.name);
  });
  app.post<{ Params: { tagId: string } }>('/api/tags/:tagId/merge', async (request) => {
    const body = tagMergeSchema.parse(request.body);
    return service.mergeTag(
      requireUser(request).id,
      request.params.tagId,
      body.expectedVersion,
      body.targetTagId,
    );
  });
  app.get<{ Params: { tagId: string } }>('/api/tags/:tagId/deletion-impact', async (request) =>
    service.tagImpact(requireUser(request).id, request.params.tagId),
  );
  app.delete<{ Params: { tagId: string } }>('/api/tags/:tagId', async (request, reply) => {
    const body = tagDeleteSchema.parse(request.body);
    service.deleteTag(
      requireUser(request).id,
      request.params.tagId,
      body.expectedVersion,
      body.expectedBookmarkCount,
      body.expectedSavedSearchCount,
    );
    return reply.status(204).send();
  });
}
