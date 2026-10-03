import type { FastifyPluginAsync } from 'fastify';
import { ValidationError } from '../../shared/api/errors.js';
import { MetadataDraftRepository } from '../db/repositories/metadata-draft-repository.js';
import { sendAsset } from '../media/asset-response.js';
import { MetadataService } from '../services/metadata/metadata-service.js';

export const metadataRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/metadata/preview', async (request, reply) => {
    const url = (request.body as any)?.url;
    if (typeof url !== 'string') throw new ValidationError('Enter a web address.', { url: ['Enter a web address.'] });
    const controller = new AbortController();
    request.raw.once('aborted', () => controller.abort());
    try { return await new MetadataService(app.db).inspect(url, controller.signal); }
    catch (error) {
      if ((error as any).validation) throw new ValidationError((error as Error).message, { url: [(error as Error).message] });
      if ((error as any).rateLimited) return reply.header('Retry-After','2').status(429).send({ code: 'METADATA_BUSY', message: (error as Error).message });
      throw error;
    }
  });
  app.get('/api/metadata/drafts/:draftId/:kind', async (request, reply) => {
    const { draftId, kind } = request.params as any;
    if (!['icon','preview'].includes(kind)) return reply.status(404).send({ code:'NOT_FOUND', message:'Image not found.' });
    const asset = new MetadataDraftRepository(app.db).getAsset(draftId,kind);
    if (!asset) return reply.status(404).send({ code:'NOT_FOUND', message:'Image not found.' });
    return sendAsset(request,reply,asset,false);
  });
};
