import type { FastifyPluginAsync } from 'fastify';
import { MediaRepository } from '../db/repositories/media-repository.js';
import { sendAsset } from '../media/asset-response.js';

export const assetRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/assets/:assetId', async (request,reply) => {
    const id = (request.params as any).assetId as string;
    if (!/^[a-f0-9]{64}$/u.test(id)) return reply.status(404).send({ code:'NOT_FOUND',message:'Image not found.' });
    const asset = new MediaRepository(app.db).get(id);
    if (!asset) return reply.status(404).send({ code:'NOT_FOUND',message:'Image not found.' });
    return sendAsset(request,reply,asset);
  });
};
