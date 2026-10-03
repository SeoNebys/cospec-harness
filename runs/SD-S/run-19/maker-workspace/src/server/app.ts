import express, { type ErrorRequestHandler, type Express } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import type { ErrorCode } from '../shared/types.js';
import type { BookmarkDatabase } from './db/client.js';
import { openDatabase } from './db/client.js';
import { runMigrations } from './db/migrations.js';
import { BookmarkRepository } from './db/bookmark-repository.js';
import { createBookmarksRouter } from './api/bookmarks.js';
import { createMetadataRouter } from './api/metadata.js';
import { createTagsRouter } from './api/tags.js';
import { MetadataFetcher } from './services/metadata-fetcher.js';
import { UrlPolicyError } from './services/url-policy.js';

export interface AppOptions {
  database?: BookmarkDatabase;
  staticDirectory?: string | false;
  metadataFetcher?: Pick<MetadataFetcher, 'preview'>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const database = options.database ?? openDatabase();
  runMigrations(database);
  const repository = new BookmarkRepository(database);
  const metadataFetcher = options.metadataFetcher ?? new MetadataFetcher();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.use('/api/metadata', createMetadataRouter(metadataFetcher));
  app.use('/api/bookmarks', createBookmarksRouter(repository));
  app.use('/api/tags', createTagsRouter(repository));

  const defaultStatic = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client');
  const staticDirectory = options.staticDirectory === undefined ? defaultStatic : options.staticDirectory;
  if (staticDirectory && existsSync(staticDirectory)) {
    app.use(express.static(staticDirectory));
    app.get('*splat', (request, response, next) => {
      if (request.path.startsWith('/api/')) return next();
      response.sendFile(path.join(staticDirectory, 'index.html'));
    });
  }

  app.use((request, response) => {
    if (request.path.startsWith('/api/')) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'That API route does not exist.' } });
      return;
    }
    response.status(404).send('Not found');
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) } });
      return;
    }
    if (error instanceof UrlPolicyError) {
      response.status(422).json({ error: { code: error.code, message: error.message, field: 'url' } });
      return;
    }
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      response.status(422).json({
        error: {
          code: 'INVALID_REQUEST',
          message: issue?.message ?? 'Check the submitted values and try again.',
          ...(issue?.path[0] ? { field: String(issue.path[0]) } : {}),
        },
      });
      return;
    }
    console.error(error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  };
  app.use(errorHandler);

  app.locals.database = database;
  return app;
}
