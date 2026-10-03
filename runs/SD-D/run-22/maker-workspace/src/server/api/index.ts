import type { FastifyPluginAsync } from 'fastify';
import { bookmarkRoutes } from './bookmark-routes.js';
import { iconRoutes } from './icon-routes.js';
import { metadataRoutes } from './metadata-routes.js';
import { tagRoutes } from './tag-routes.js';

export const apiRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ data: { status: 'ok' } }));
  await app.register(metadataRoutes);
  await app.register(bookmarkRoutes);
  await app.register(iconRoutes);
  await app.register(tagRoutes);
};
