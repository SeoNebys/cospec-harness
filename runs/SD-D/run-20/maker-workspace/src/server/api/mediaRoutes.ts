import type { FastifyInstance } from 'fastify';
import type { MediaStore } from '../metadata/mediaStore.js';
import type { MediaRepository } from '../repositories/mediaRepository.js';

export function mediaRoutes(app: FastifyInstance, repository: MediaRepository, store: MediaStore): void {
  app.get('/api/media/:assetId', async (request, reply) => {
    const row = repository.findByPublicId((request.params as { assetId: string }).assetId);
    if (!row) throw Object.assign(new Error('Media not found.'), { statusCode: 404, code: 'NOT_FOUND' });
    const bytes = await store.bytes(row);
    return reply
      .header('content-type', row.media_type)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(bytes);
  });
}
