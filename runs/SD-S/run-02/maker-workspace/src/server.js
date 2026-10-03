import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDatabase } from './db.js';
import { createBookmarksRouter } from './routes/bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build the Express app. Exported (with an injectable db) so tests can mount it
 * against a temporary database.
 */
export function createApp(db, options = {}) {
  const app = express();
  const pending = new Set();
  app.locals.pendingEnrichment = pending;
  app.use(express.json());
  app.use('/api', createBookmarksRouter(db, { ...options, pending }));
  app.use(express.static(join(__dirname, '..', 'public')));

  // Centralized error handler (contracts/rest-api.md error shape).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
      error: { code: 'internal_error', message: 'Something went wrong.' },
    });
  });

  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const db = openDatabase();
  const app = createApp(db);
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${PORT}`);
  });
}
