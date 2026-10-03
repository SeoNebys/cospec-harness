import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb } from './db/index.js';
import bookmarksRouter from './routes/bookmarks.js';
import tagsRouter from './routes/tags.js';
import viewsRouter from './routes/views.js';
import preferencesRouter from './routes/preferences.js';
import ioRouter from './routes/ioRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  // Ensure the shared collection DB is initialized at startup (FR-042).
  getDb();

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // A single global cookie for convenience only. It carries NO data key and is
  // never used to scope or partition the collection (FR-042).
  app.use((req, res, next) => {
    if (!req.headers.cookie || !req.headers.cookie.includes('bm_session=')) {
      res.setHeader(
        'Set-Cookie',
        `bm_session=${crypto.randomBytes(8).toString('hex')}; Path=/; HttpOnly; SameSite=Lax`
      );
    }
    next();
  });

  // API routes.
  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/views', viewsRouter);
  app.use('/api/preferences', preferencesRouter);
  app.use('/api', ioRouter); // /api/import, /api/export, /api/bookmarks/:id/preserve...

  // Static front end.
  app.use(express.static(path.join(__dirname, 'public')));

  // Centralized error handler → JSON error shape.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({
      error: { code: 'internal_error', message: 'An unexpected error occurred.' },
    });
  });

  return app;
}
