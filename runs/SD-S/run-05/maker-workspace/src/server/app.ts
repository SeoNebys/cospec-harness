import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { DB } from './db.js';
import { ApiError } from './services/errors.js';
import { registerBookmarkRoutes } from './routes/bookmarks.js';
import { registerTagRoutes } from './routes/tags.js';

const here = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(here, '../../dist/web');

// Builds the Fastify app around an open database. Kept separate from index.ts so
// integration tests can build an app against a temporary in-memory database.
export function buildApp(db: DB): FastifyInstance {
  const app = Fastify({ logger: false });

  // Turn typed ApiError into the { error, message } contract; anything else 500s.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.code(err.status).send(err.toBody());
    }
    reply.code(500).send({ error: 'internal', message: 'Something went wrong.' });
  });

  registerBookmarkRoutes(app, db);
  registerTagRoutes(app, db);

  // Serve the built browser UI when present (production/`npm start`). During
  // tests the dist bundle may not exist yet; that's fine — the API still works.
  if (existsSync(WEB_DIR)) {
    app.register(fastifyStatic, { root: WEB_DIR });
  }

  return app;
}
