import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { migrate } from './db/migrations.js';
import bookmarksRouter from './routes/bookmarks.js';
import capturesRouter from './routes/captures.js';
import tagsRouter from './routes/tags.js';
import viewsRouter from './routes/views.js';
import importExportRouter from './routes/importexport.js';
import preferencesRouter from './routes/preferences.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '../web/dist');

migrate();

const app = express();
app.use(express.json({ limit: '25mb' }));

// API routers (all mounted under /api).
app.use('/api', bookmarksRouter);
app.use('/api', capturesRouter);
app.use('/api', tagsRouter);
app.use('/api', viewsRouter);
app.use('/api', importExportRouter);
app.use('/api', preferencesRouter);

// Serve the built SPA and fall back to index.html for client routes.
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(resolve(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res
      .status(200)
      .send('<h1>Bookmark Manager</h1><p>Frontend not built yet. Run <code>npm run build</code>.</p>');
  });
}

// Centralized error handler → { error }.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark Manager listening on http://0.0.0.0:${PORT}`);
});

export default app;
