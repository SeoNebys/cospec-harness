import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { apiRoutes } from './api/index.js';
import type { AppConfig } from './config.js';
import { loadConfig } from './config.js';
import type { AppDatabase } from './db/database.js';
import { openDatabase } from './db/database.js';
import type { RuntimeDependencies } from './runtime.js';
import { systemRuntime } from './runtime.js';

export interface BuildAppOptions {
  config?: AppConfig;
  database?: AppDatabase;
  runtime?: RuntimeDependencies;
  logger?: boolean;
  clientDirectory?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    database: AppDatabase;
    runtime: RuntimeDependencies;
    appConfig: AppConfig;
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({ logger: options.logger ?? config.NODE_ENV !== 'test' });
  const database = options.database ?? openDatabase({ path: config.DATABASE_PATH });

  app.decorate('database', database);
  app.decorate('runtime', options.runtime ?? systemRuntime);
  app.decorate('appConfig', config);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.join('.') || '_root';
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.', fieldErrors },
      });
    }

    request.log.error({ err: error }, 'Request failed');
    const candidateStatus =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 500;
    const statusCode = candidateStatus >= 400 && candidateStatus < 600 ? candidateStatus : 500;
    const message = error instanceof Error ? error.message : 'The request failed.';
    return reply.status(statusCode).send({
      error: {
        code: statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: statusCode === 500 ? 'Something went wrong.' : message,
      },
    });
  });

  await app.register(apiRoutes, { prefix: '/api' });

  const clientDirectory = options.clientDirectory ?? path.resolve('dist/client');
  if (existsSync(clientDirectory)) {
    await app.register(fastifyStatic, { root: clientDirectory, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api/')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
      }
      return reply.sendFile('index.html');
    });
  }

  app.addHook('onClose', async () => database.close());
  return app;
}
