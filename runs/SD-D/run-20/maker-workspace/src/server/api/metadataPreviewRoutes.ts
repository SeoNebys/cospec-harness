import type { FastifyInstance } from 'fastify';
import { createPreviewSchema } from '../../shared/schemas/api.js';
import type { MetadataPreviewService } from '../services/metadataPreviewService.js';

export function metadataPreviewRoutes(app: FastifyInstance, service: MetadataPreviewService): void {
  app.post('/api/metadata-previews', async (request, reply) =>
    reply.send(await service.create(createPreviewSchema.parse(request.body).url)),
  );
}
