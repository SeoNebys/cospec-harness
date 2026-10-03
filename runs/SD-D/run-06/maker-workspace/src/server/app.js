import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import bookmarksRouter from './routes/bookmarks.js';
import preservationRouter from './routes/preservation.js';
import tagsRouter from './routes/tags.js';
import searchRouter from './routes/search.js';
import viewsRouter from './routes/views.js';
import importExportRouter from './routes/importexport.js';
import preferencesRouter from './routes/preferences.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..', 'web');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  // API
  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/bookmarks', preservationRouter); // /:id/preserve/*
  app.use('/api/tags', tagsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/views', viewsRouter);
  app.use('/api', importExportRouter); // /import, /export
  app.use('/api/preferences', preferencesRouter);

  // Static client
  app.use(express.static(WEB_DIR));

  // Centralized error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
  });

  return app;
}
