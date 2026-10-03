import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import './db/db.js';
import { router as bookmarksRouter } from './api/bookmarks.js';
import { router as preservationRouter } from './api/preservation.js';
import { router as tagsRouter } from './api/tags.js';
import { router as searchRouter } from './api/search.js';
import { router as savedSearchesRouter } from './api/savedSearches.js';
import { router as importRouter } from './api/importExport.js';
import { router as preferencesRouter } from './api/preferences.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));

// API routes. Preservation routes share the /bookmarks prefix.
app.use('/api/bookmarks', preservationRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/search', searchRouter);
app.use('/api/saved-searches', savedSearchesRouter);
app.use('/api/import', importRouter);
app.use('/api/export', importRouter);
app.use('/api/preferences', preferencesRouter);

// Static client (built by Vite) with SPA fallback.
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Centralized error handler.
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: { code: 'internal', message: err.message || 'Internal error' } });
});

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});

export default app;
