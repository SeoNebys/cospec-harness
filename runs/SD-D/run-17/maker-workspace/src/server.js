import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db/index.js'; // runs migrations on import

import bookmarksRouter from './routes/bookmarks.js';
import tagsRouter from './routes/tags.js';
import filtersRouter from './routes/filters.js';
import preferencesRouter from './routes/preferences.js';
import ioRouter from './routes/io.js';
import viewsRouter from './routes/views.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/filters', filtersRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api', ioRouter); // /api/import, /api/export
app.use('/', viewsRouter);

// Centralized error handler ({error} shape).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong: ' + (err.message || 'unknown error') });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark Manager listening on http://0.0.0.0:${PORT}`);
});

export default app;
