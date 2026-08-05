/**
 * Fastify server assembly. buildServer(db) wires all routes against a given
 * database, so production uses the on-disk DB and tests use an in-memory one.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { getDb } from './db/init.js';
import { registerBookmarks } from './routes/bookmarks.js';
import { registerSearch } from './routes/search.js';
import { registerTags } from './routes/tags.js';
import { registerSnapshot } from './routes/snapshot.js';
import { registerImportExport } from './routes/importexport.js';
import { registerSavedSearches } from './routes/savedSearches.js';
import { registerPreferences } from './routes/preferences.js';
import { registerBackup } from './routes/backup.js';

const here = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = resolve(here, '..', '..', 'frontend', 'dist');

export interface BuildOptions {
  logger?: boolean;
  enricher?: Parameters<typeof registerBookmarks>[2];
  serveFrontend?: boolean;
}

export async function buildServer(
  db: Database.Database,
  opts: BuildOptions = {}
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: true });
  await app.register(multipart);

  const api = async (scope: FastifyInstance) => {
    registerBookmarks(scope, db, opts.enricher);
    registerSearch(scope, db);
    registerTags(scope, db);
    registerSnapshot(scope, db);
    registerImportExport(scope, db);
    registerSavedSearches(scope, db);
    registerPreferences(scope, db);
    registerBackup(scope, db);
  };
  await app.register(api, { prefix: '/api' });

  app.get('/health', async () => ({ ok: true }));

  // Serve the built frontend if present (single-origin local app).
  if ((opts.serveFrontend ?? true) && existsSync(FRONTEND_DIST)) {
    await app.register(fastifyStatic, { root: FRONTEND_DIST });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.code(404).send({ error: 'Not found' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}

const PORT = Number(process.env.PORT ?? 4321);

export async function start(): Promise<FastifyInstance> {
  const app = await buildServer(getDb(), { logger: true });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  return app;
}

// Run directly (node/tsx src/server.ts)
if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
