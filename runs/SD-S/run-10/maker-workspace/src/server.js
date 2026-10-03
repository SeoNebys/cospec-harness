// Express app: serves the REST API under /api and the static UI from public/.
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { BookmarkRepository } from './repository.js';
import { createBookmarksRouter } from './routes/bookmarks.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Build the Express app. Accepts an optional repository (used by tests with a
 * temporary database); otherwise opens the default on-disk database.
 */
export function createApp(repo = new BookmarkRepository(openDatabase())) {
  const app = express();
  app.use(express.json());

  app.use('/api', createBookmarksRouter(repo));
  app.use(express.static(resolve(projectRoot, 'public')));

  // JSON 404 for unknown API routes.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // JSON error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  });

  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  createApp().listen(port, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${port}`);
  });
}
