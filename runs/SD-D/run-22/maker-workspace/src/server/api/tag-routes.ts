import type { FastifyPluginAsync } from 'fastify';

import { TagRepository } from '../repositories/tag-repository.js';

export const tagRoutes: FastifyPluginAsync = async (app) => {
  const repository = new TagRepository(app.database);
  app.get('/tags', async () => ({ data: repository.listWithBookmarkCounts() }));
};
