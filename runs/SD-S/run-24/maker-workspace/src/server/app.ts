import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import express, { type Express } from 'express';

import type { BookmarkDatabase } from './db/database.js';
import { errorHandler } from './middleware/error-handler.js';
import { createApiRouter } from './routes/index.js';

export function createApp(db: BookmarkDatabase): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', createApiRouter(db));

  const clientDirectory = resolve(process.cwd(), 'dist/client');
  if (existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory));
    app.get(/.*/u, (request, response, next) => {
      if (request.path.startsWith('/api/')) {
        next();
        return;
      }
      response.sendFile(resolve(clientDirectory, 'index.html'));
    });
  }

  app.use('/api', (_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'The requested resource could not be found.' },
    });
  });
  app.use(errorHandler);
  return app;
}
