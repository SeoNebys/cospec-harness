import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Env } from './config/env.js';
import type { Database } from './db/database.js';
import { SessionRepository } from './repositories/session-repository.js';
import { UserRepository } from './repositories/user-repository.js';
import { BookmarkRepository } from './repositories/bookmark-repository.js';
import { TagRepository } from './repositories/tag-repository.js';
import { ImportRepository } from './repositories/import-repository.js';
import { authRoutes } from './routes/auth.js';
import { bookmarkRoutes } from './routes/bookmarks.js';
import { healthRoutes } from './routes/health.js';
import { metadataRoutes } from './routes/metadata.js';
import { tagRoutes } from './routes/tags.js';
import { importRoutes } from './routes/imports.js';
import { exportRoutes } from './routes/exports.js';
import { applySecurityHeaders } from './security/headers.js';
import { isAllowedOrigin } from './security/origin.js';
import { loggerRedactPaths } from './security/redaction.js';
import { enterRequest, leaveRequest } from './security/rate-limit.js';
import { AuthService } from './services/auth/auth-service.js';
import { BookmarkService } from './services/bookmarks/bookmark-service.js';
import { MetadataService } from './services/metadata/metadata-service.js';
import { PreviewStore } from './services/metadata/preview-store.js';
import { ImportService } from './services/imports/import-service.js';
import { ExportService } from './services/exports/export-service.js';

export async function buildApp(db: Database, env: Env): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.databasePath === ':memory:' ? false : { redact: loggerRedactPaths }, bodyLimit: env.uploadBytes });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: env.uploadBytes, files: 1 } });
  app.addHook('onRequest', async (request, reply) => {
    applySecurityHeaders(reply);
    if (!enterRequest(request, reply)) return reply;
    if (!isAllowedOrigin(request)) return reply.code(403).send({ error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed.' } });
  });
  app.addHook('onResponse', async () => { leaveRequest(); });
  app.setErrorHandler((error: any, _request, reply) => {
    const status = Number(error.statusCode) >= 400 ? Number(error.statusCode) : 500;
    reply.code(status).send({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message: status === 500 ? 'Something went wrong. Please try again.' : error.message } });
  });
  const auth = new AuthService(new UserRepository(db), new SessionRepository(db), env);
  await healthRoutes(app, db);
  await authRoutes(app, auth, env);
  const previews = new PreviewStore();
  const bookmarks = new BookmarkRepository(db);
  await metadataRoutes(app, auth, new MetadataService(env, previews));
  await bookmarkRoutes(app, auth, new BookmarkService(bookmarks, previews), bookmarks);
  await tagRoutes(app, auth, new TagRepository(db));
  await importRoutes(app, auth, new ImportService(db, new ImportRepository(db), bookmarks));
  await exportRoutes(app, auth, new ExportService(db));

  const clientRoot = join(process.cwd(), 'dist/client');
  if (existsSync(clientRoot)) {
    await app.register(staticPlugin, { root: clientRoot, wildcard: false });
    app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/')
      ? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } })
      : reply.sendFile('index.html'));
  }
  return app;
}
