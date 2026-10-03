import type { FastifyInstance } from 'fastify';
import { requireUser } from '../auth/auth-plugin.js';
import type { MediaService } from '../media/media-service.js';

export async function registerMediaRoutes(app: FastifyInstance, mediaService: MediaService): Promise<void> {
  app.get<{ Params: { mediaId: string } }>('/api/media/:mediaId', async (request, reply) => {
    const user = requireUser(request);
    const { media, bytes } = await mediaService.readOwned(request.params.mediaId, user.id);
    return reply
      .header('Content-Type', media.mimeType)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, max-age=3600')
      .send(bytes);
  });
}
