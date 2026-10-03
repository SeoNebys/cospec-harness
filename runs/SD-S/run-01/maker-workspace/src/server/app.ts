import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { Router, type Express } from 'express';
import type { BookmarkDatabase } from './db/connection.js';
import { errorHandler } from './middleware/error-handler.js';

export interface CreateAppOptions {
  database: BookmarkDatabase;
  apiRouter?: Router;
  clientDirectory?: string;
}

export function createApp({ database, apiRouter = Router(), clientDirectory }: CreateAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_request, response) => {
    database.prepare('SELECT 1').get();
    response.json({ status: 'ready' });
  });
  app.use('/api', apiRouter);

  if (clientDirectory && existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory, { index: false }));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) return next();
      response.sendFile(path.join(clientDirectory, 'index.html'));
    });
  }

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } });
  });
  app.use(errorHandler);
  return app;
}
