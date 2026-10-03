import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { getDb } from './db/connection.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { tagsRouter } from './routes/tags.js';
import { savedSearchesRouter } from './routes/savedSearches.js';
import { preferencesRouter } from './routes/preferences.js';
import { importExportRouter } from './routes/importExport.js';

// Use the preinstalled shared browser binaries for snapshots.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/playwright-browsers';
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = join(__dirname, '..', '..', 'web', 'dist');

export function createApp() {
  const db = getDb();
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const api = express.Router();
  api.use('/bookmarks', bookmarksRouter(db));
  api.use('/tags', tagsRouter(db));
  api.use('/saved-searches', savedSearchesRouter(db));
  api.use('/preferences', preferencesRouter(db));
  api.use('/', importExportRouter(db)); // /import, /export
  app.use('/api', api);

  // Serve the built frontend.
  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(join(WEB_DIST, 'index.html'));
    });
  }

  // Uniform error shape.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    if (res.headersSent) return;
    res.status(500).json({ error: { code: 'server_error', message: err.message || 'Server error.' } });
  });

  return app;
}

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Start only when run directly (not when imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
  });
}
