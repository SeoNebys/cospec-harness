import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { getDb, type DB } from './db/db.ts';
import { AppError } from './lib/errors.ts';
import { CaptureQueue } from './services/captureQueue.ts';
import { registerBookmarkRoutes } from './routes/bookmarks.ts';
import { registerTagRoutes } from './routes/tags.ts';
import { registerViewRoutes } from './routes/views.ts';
import { registerPreferenceRoutes } from './routes/preferences.ts';
import { registerImportExportRoutes } from './routes/importExport.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

export interface BuildOptions {
  db?: DB;
  serveStatic?: boolean;
  logger?: boolean;
}

/** Build the Fastify app. Exported so integration tests can use app.inject(). */
export function buildApp(opts: BuildOptions = {}): {
  app: FastifyInstance;
  db: DB;
  queue: CaptureQueue;
} {
  const db = opts.db ?? getDb();
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 20 * 1024 * 1024 });
  const queue = new CaptureQueue(db);

  // Accept raw HTML bodies for /api/import (in addition to multipart uploads).
  app.addContentTypeParser(
    'text/html',
    { parseAs: 'string' },
    (_req, body, done) => done(null, body),
  );

  void app.register(fastifyMultipart);

  // Central error handler → typed JSON envelope (contracts/api.md).
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply
        .code(err.statusCode)
        .send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: { code: 'bad_request', message: 'Invalid request.', details: err.issues },
      });
    }
    app.log.error(err);
    return reply
      .code(500)
      .send({ error: { code: 'internal_error', message: 'Something went wrong.' } });
  });

  registerBookmarkRoutes(app, db, queue);
  registerTagRoutes(app, db);
  registerViewRoutes(app, db);
  registerPreferenceRoutes(app, db);
  registerImportExportRoutes(app, db, queue);

  app.get('/api/health', async () => ({ ok: true }));

  // Serve the built SPA (production) with history-API fallback to index.html.
  if ((opts.serveStatic ?? true) && existsSync(FRONTEND_DIST)) {
    void app.register(fastifyStatic, { root: FRONTEND_DIST, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        return reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } });
      }
      return reply.sendFile('index.html');
    });
  }

  return { app, db, queue };
}

// Start when run directly (npm start → tsx backend/src/server.ts).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { app } = buildApp({ logger: true });
  const port = Number(process.env.PORT ?? 4000);
  app
    .listen({ host: '0.0.0.0', port })
    .then((addr) => app.log.info(`Bookmark Manager listening on ${addr}`))
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
