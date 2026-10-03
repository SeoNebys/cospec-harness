import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db/index.js';
import bookmarksRouter from './api/bookmarks.js';
import preservationRouter from './api/preservation.js';
import tagsRouter from './api/tags.js';
import savedSearchesRouter from './api/savedSearches.js';
import preferencesRouter from './api/preferences.js';
import importExportRouter from './api/importExport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

migrate(); // ensure schema exists on startup

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/bookmarks', preservationRouter); // /:id/preserve, /archive-org, /preserved
  app.use('/api/tags', tagsRouter);
  app.use('/api/saved-searches', savedSearchesRouter);
  app.use('/api/preferences', preferencesRouter);
  app.use('/api', importExportRouter); // /import, /export

  app.use(express.static(join(__dirname, '..', 'public')));

  // Centralised error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: { code: 'internal', message: err.message || 'Internal error' } });
  });

  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  createApp().listen(port, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${port}`);
  });
}
