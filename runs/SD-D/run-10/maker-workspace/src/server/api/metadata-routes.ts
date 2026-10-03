import type { FastifyInstance } from 'fastify';
import { mediaCaptureSchema, metadataPreviewSchema } from '../../shared/contracts/metadata.js';
import { requireUser } from '../auth/auth-plugin.js';
import type { MediaService } from '../media/media-service.js';
import type { MetadataService } from '../metadata/metadata-service.js';

export async function registerMetadataRoutes(
  app: FastifyInstance,
  dependencies: { metadata: MetadataService; media: MediaService },
): Promise<void> {
  app.post('/api/metadata/preview', async (request) => {
    const user = requireUser(request);
    const input = metadataPreviewSchema.parse(request.body);
    return dependencies.metadata.preview(user.id, input.url);
  });

  app.post('/api/media/capture', async (request, reply) => {
    const user = requireUser(request);
    const input = mediaCaptureSchema.parse(request.body);
    const media = await dependencies.media.capture(user.id, input.purpose, input.url);
    return reply.status(201).send({ id: media.publicId, url: `/api/media/${media.publicId}` });
  });
}
