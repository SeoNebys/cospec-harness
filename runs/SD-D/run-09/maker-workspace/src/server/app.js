import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bookmarksRouter } from './routes/bookmarks.js';
import { tagsRouter } from './routes/tags.js';
import { filtersRouter } from './routes/filters.js';
import { importExportRouter } from './routes/importExport.js';
import { preferencesRouter } from './routes/preferences.js';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '../../dist');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/bookmarks', bookmarksRouter());
  app.use('/api/tags', tagsRouter());
  app.use('/api/filters', filtersRouter());
  app.use('/api', importExportRouter()); // /api/import, /api/export
  app.use('/api/preferences', preferencesRouter());

  // Serve the built frontend if present.
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(resolve(distDir, 'index.html'));
    });
  }

  // Centralized error handler → Error schema.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error('[api error]', err);
    res.status(500).json({ error: 'Internal error', detail: err.message });
  });

  return app;
}
