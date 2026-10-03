// Express application wiring: JSON parsing, API routes, static client, errors.
import express from 'express';
import { config } from './config.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { searchRouter } from './routes/search.js';
import { tagsRouter } from './routes/tags.js';
import { preferencesRouter } from './routes/preferences.js';
import { savedSearchesRouter } from './routes/savedSearches.js';
import { importExportRouter } from './routes/importExport.js';
import { preservationRouter } from './routes/preservation.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // API routes
  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/bookmarks', preservationRouter); // /:id/preserve, /:id/preserved, /:id/archive-org
  app.use('/api/search', searchRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/preferences', preferencesRouter);
  app.use('/api/saved-searches', savedSearchesRouter);
  app.use('/api', importExportRouter); // /export, /import

  // Static single-page client
  app.use(express.static(config.webDir));

  // 404 for unknown API routes
  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Unknown API route' } });
  });

  // JSON error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const code = err.code || (status === 400 ? 'bad_request' : 'internal_error');
    res.status(status).json({ error: { code, message: err.message || 'Unexpected error' } });
  });

  return app;
}
