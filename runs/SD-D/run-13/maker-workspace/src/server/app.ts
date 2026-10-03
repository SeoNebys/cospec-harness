import Fastify from 'fastify';
import type { BookmarkDatabase } from './db/connection.js';
import { healthRoutes } from './routes/health.js';
import { registerErrorHandler } from './plugins/errors.js';
import { registerOriginProtection } from './security/origin.js';
import { registerSecurityHeaders } from './security/headers.js';
import { registerStaticClient } from './plugins/static-client.js';
import { bookmarkRoutes } from './routes/bookmarks.js';
import { metadataRoutes } from './routes/metadata.js';
import { assetRoutes } from './routes/assets.js';
import { tagRoutes } from './routes/tags.js';
import { preferenceRoutes } from './routes/preferences.js';

export interface AppDependencies { db: BookmarkDatabase }

export async function buildApp(deps: AppDependencies, logger: boolean | object = true) {
  const app = Fastify({ logger, bodyLimit: 256 * 1024 });
  app.decorate('db', deps.db);
  registerErrorHandler(app);
  registerOriginProtection(app);
  registerSecurityHeaders(app);
  await app.register(healthRoutes);
  await app.register(metadataRoutes);
  await app.register(bookmarkRoutes);
  await app.register(assetRoutes);
  await app.register(tagRoutes);
  await app.register(preferenceRoutes);
  await registerStaticClient(app);
  return app;
}

declare module 'fastify' { interface FastifyInstance { db: BookmarkDatabase } }
