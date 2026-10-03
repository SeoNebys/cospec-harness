import staticPlugin from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppDatabase } from './db/connection.js';
import { openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { bookmarkRoutes } from './api/bookmarkRoutes.js';
import { bulkActionRoutes } from './api/bulkActionRoutes.js';
import { installErrorHandling } from './api/errors.js';
import { mediaRoutes } from './api/mediaRoutes.js';
import { metadataPreviewRoutes } from './api/metadataPreviewRoutes.js';
import { tagRoutes } from './api/tagRoutes.js';
import { MediaStore } from './metadata/mediaStore.js';
import { restrictedFetch, type RestrictedTransport } from './metadata/restrictedFetch.js';
import { BookmarkRepository } from './repositories/bookmarkRepository.js';
import { MediaRepository } from './repositories/mediaRepository.js';
import { MetadataPreviewRepository } from './repositories/metadataPreviewRepository.js';
import { TagRepository } from './repositories/tagRepository.js';
import { BookmarkService } from './services/bookmarkService.js';
import { BulkActionService } from './services/bulkActionService.js';
import { MetadataPreviewService } from './services/metadataPreviewService.js';
import { TagService } from './services/tagService.js';
import { cleanupExpiredAssets } from './metadata/cleanup.js';

export interface AppOptions {
  db?: AppDatabase;
  dbPath?: string;
  fetcher?: RestrictedTransport;
  logger?: boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  const db = options.db ?? openDatabase(options.dbPath);
  migrate(db);
  installErrorHandling(app);
  app.addHook('onSend', async (_request, reply, payload) => {
    reply
      .header('x-content-type-options', 'nosniff')
      .header('x-frame-options', 'DENY')
      .header('referrer-policy', 'no-referrer')
      .header(
        'content-security-policy',
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
      );
    return payload;
  });
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin) {
      const expected = `${request.protocol}://${request.headers.host}`;
      if (origin !== expected)
        return reply
          .status(403)
          .send({ code: 'CROSS_ORIGIN_BLOCKED', message: 'Cross-origin requests are not allowed.' });
    }
  });
  app.get('/api/health', () => ({ status: 'ready' }));
  const fetcher = options.fetcher ?? restrictedFetch;
  const mediaRepository = new MediaRepository(db);
  const mediaStore = new MediaStore(mediaRepository, fetcher);
  const bookmarkRepository = new BookmarkRepository(db);
  bookmarkRoutes(app, new BookmarkService(db), bookmarkRepository);
  bulkActionRoutes(app, new BulkActionService(db));
  tagRoutes(app, new TagService(new TagRepository(db)));
  metadataPreviewRoutes(
    app,
    new MetadataPreviewService(db, new MetadataPreviewRepository(db), mediaStore, fetcher),
  );
  mediaRoutes(app, mediaRepository, mediaStore);
  await cleanupExpiredAssets(db);
  const cleanupTimer = setInterval(() => void cleanupExpiredAssets(db), 60 * 60_000);
  cleanupTimer.unref();
  const clientRoot = resolve('dist/client');
  if (existsSync(clientRoot)) {
    await app.register(staticPlugin, { root: clientRoot, prefix: '/' });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.status(404).send({ code: 'NOT_FOUND', message: 'API route not found.' })
        : reply.sendFile('index.html'),
    );
  }
  app.addHook('onClose', async () => {
    clearInterval(cleanupTimer);
    if (db.open) db.close();
  });
  return app;
}
