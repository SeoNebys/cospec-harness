import Fastify, { type FastifyInstance } from 'fastify';
import staticPlugin from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from './config/schema.js';
import { loadConfig } from './config/schema.js';
import { loggerOptions } from './config/logger.js';
import { openDatabase } from './db/database.js';
import { runMigrations } from './db/migration-runner.js';
import { AuthRepository } from './repositories/auth-repository.js';
import { createMailProvider } from './auth/mail-provider.js';
import { AuthService } from './auth/auth-service.js';
import { installAuth } from './auth/auth-plugin.js';
import { registerAuthRoutes } from './api/auth-routes.js';
import { installErrorHandler } from './api/errors.js';
import { MediaRepository } from './repositories/media-repository.js';
import { MediaService } from './media/media-service.js';
import { BookmarkRepository } from './repositories/bookmark-repository.js';
import { BookmarkService } from './domain/bookmark-service.js';
import { MetadataService } from './metadata/metadata-service.js';
import { registerMetadataRoutes } from './api/metadata-routes.js';
import { registerMediaRoutes } from './api/media-routes.js';
import { registerBookmarkRoutes } from './api/bookmark-routes.js';
import { TagRepository } from './repositories/tag-repository.js';
import { CollectionRepository } from './repositories/collection-repository.js';
import { SearchIndexService } from './search/search-index-service.js';
import { OrganizationService } from './domain/organization-service.js';
import { SearchRepository } from './repositories/search-repository.js';
import { registerTagRoutes } from './api/tag-routes.js';
import { registerCollectionRoutes } from './api/collection-routes.js';
import { ArchiveService } from './domain/archive-service.js';
import { BookmarkStateService } from './domain/bookmark-state-service.js';
import { registerArchiveRoutes } from './api/archive-routes.js';
import { SavedSearchRepository } from './repositories/saved-search-repository.js';
import { SavedSearchService } from './domain/saved-search-service.js';
import { registerSavedSearchRoutes } from './api/saved-search-routes.js';
import { BulkRepository } from './repositories/bulk-repository.js';
import { BulkService } from './domain/bulk-service.js';
import { registerBulkRoutes } from './api/bulk-routes.js';
import { installSecurity } from './config/security.js';
import { CleanupService } from './domain/cleanup-service.js';
import { MaintenanceService } from './domain/maintenance-service.js';
import { validateProduction } from './config/production.js';

export type AppOptions = { config?: AppConfig };

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  validateProduction(config);
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: config.trustProxy,
    bodyLimit: 2 * 1024 * 1024,
    requestTimeout: 15_000,
  });
  const database = openDatabase(config.databasePath);
  runMigrations(database);

  const authRepository = new AuthRepository(database);
  const mailProvider = createMailProvider(config, app.log);
  const authService = new AuthService(authRepository, mailProvider, config.sessionDays, config.resetMinutes);
  const mediaRepository = new MediaRepository(database);
  const mediaService = new MediaService(mediaRepository, resolve(config.assetDirectory));
  await mediaService.initialize();
  await mediaService.cleanupExpiredDrafts();
  const bookmarkRepository = new BookmarkRepository(database);
  const searchIndex = new SearchIndexService(database);
  const tagRepository = new TagRepository(database);
  const collectionRepository = new CollectionRepository(database);
  const organizationService = new OrganizationService(tagRepository, collectionRepository, searchIndex);
  const bookmarkService = new BookmarkService(
    bookmarkRepository,
    mediaService,
    organizationService,
    searchIndex,
  );
  const searchRepository = new SearchRepository(database, bookmarkRepository);
  const archiveService = new ArchiveService(bookmarkRepository);
  const bookmarkStateService = new BookmarkStateService(bookmarkRepository);
  const savedSearchRepository = new SavedSearchRepository(database);
  const savedSearchService = new SavedSearchService(
    savedSearchRepository,
    searchRepository,
    tagRepository,
    collectionRepository,
  );
  const bulkRepository = new BulkRepository(database, searchIndex);
  const bulkService = new BulkService(bulkRepository, bookmarkRepository, searchRepository, tagRepository);
  const metadataService = new MetadataService(mediaService);

  installErrorHandler(app);
  await installAuth(app, config, authRepository);
  installSecurity(app);
  await registerAuthRoutes(app, { config, authService });
  await registerMetadataRoutes(app, { metadata: metadataService, media: mediaService });
  await registerMediaRoutes(app, mediaService);
  await registerBookmarkRoutes(app, { bookmarks: bookmarkService, search: searchRepository });
  await registerTagRoutes(app, organizationService);
  await registerCollectionRoutes(app, organizationService);
  await registerArchiveRoutes(app, archiveService, bookmarkStateService);
  await registerSavedSearchRoutes(app, savedSearchService);
  await registerBulkRoutes(app, bulkService);

  const cleanup = new CleanupService(authRepository, bulkRepository, mediaService);
  await cleanup.run();
  cleanup.start();
  const rebuiltRows = searchIndex.rebuildIfIncomplete();
  if (rebuiltRows !== undefined) {
    app.log.warn({ rows: rebuiltRows }, 'Rebuilt incomplete search projection');
  }
  const maintenance = new MaintenanceService(database, resolve(config.assetDirectory));
  let ready = false;
  try {
    await maintenance.check();
    ready = true;
  } catch (error) {
    app.log.error({ err: error }, 'Startup maintenance check failed');
  }
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    if (!ready) return reply.status(503).send({ status: 'not-ready' });
    return { status: 'ready' };
  });

  const clientRoot = resolve('dist/client');
  if (existsSync(clientRoot)) {
    await app.register(staticPlugin, { root: clientRoot, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/health/')) {
        return reply.status(404).send({
          type: 'https://bookmark.local/problems/not-found',
          title: 'Not found',
          status: 404,
          detail: 'The requested resource was not found.',
          code: 'not_found',
          requestId: request.id,
        });
      }
      return reply.sendFile('index.html');
    });
  }

  app.addHook('onClose', async () => {
    ready = false;
    cleanup.stop();
    database.close();
  });
  return app;
}
