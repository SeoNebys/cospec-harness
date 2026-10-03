import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bookmarksRouter from './routes/bookmarks.js';
import { ServiceError } from './services/bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Build and return the configured Express app. */
export function createApp() {
  const app = express();
  app.use(express.json());

  // JSON REST API.
  app.use('/api', bookmarksRouter);

  // Static front end.
  app.use(express.static(resolve(__dirname, '..', 'public')));

  // Unknown /api routes → JSON 404 (not the static handler's HTML).
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: { code: 'not_found', message: 'Resource not found.' },
    });
  });

  // Central JSON error handler → contract error shape.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ServiceError) {
      return res
        .status(err.status || 400)
        .json({ error: { code: err.code, message: err.message } });
    }
    console.error(err);
    res.status(500).json({
      error: { code: 'internal_error', message: 'Something went wrong.' },
    });
  });

  return app;
}
