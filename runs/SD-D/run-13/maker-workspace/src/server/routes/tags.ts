import type { FastifyPluginAsync } from 'fastify';
import { ValidationError } from '../../shared/api/errors.js';
import { TagRepository } from '../db/repositories/tag-repository.js';

export const tagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/tags/suggestions', async (request) => {
    const query = request.query as any; const prefix = String(query.prefix || ''); const limit = Number(query.limit || 10);
    if ([...prefix].length > 50 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new ValidationError('Choose a valid tag prefix and suggestion limit.');
    return { items: new TagRepository(app.db).suggestions(prefix,limit) };
  });
};
