import Fastify, { type FastifyInstance } from 'fastify';
import type { DB } from './db/connection';
import { registerBookmarkRoutes } from './routes/bookmarks';
import { registerTagRoutes } from './routes/tags';
import { registerSavedSearchRoutes } from './routes/savedSearches';
import { enqueueEnrichment } from './services/enrichment';

// Enrichment is injectable so integration tests can run without network access.
export type EnrichFn = (db: DB, id: number, url: string) => void | Promise<void>;

export interface AppDeps {
  db: DB;
  enrich?: EnrichFn;
}

/** Build the Fastify app around an (injected) database. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  const enrich = deps.enrich ?? enqueueEnrichment;

  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode ?? 500;
    reply.status(status).send({
      error: { code: err.code ?? 'internal_error', message: err.message },
    });
  });

  app.register(
    async (api) => {
      registerBookmarkRoutes(api, deps.db, enrich);
      registerTagRoutes(api, deps.db);
      registerSavedSearchRoutes(api, deps.db);
    },
    { prefix: '/api' }
  );

  return app;
}
