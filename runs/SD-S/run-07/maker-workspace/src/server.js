import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb } from './db.js';
import bookmarksRouter from './routes/bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

export function createApp() {
  // Initialize the database (creates schema on first run).
  getDb();

  const app = express();
  app.use(express.json());

  // JSON API
  app.use('/api', bookmarksRouter);

  // Static frontend
  app.use(express.static(PUBLIC_DIR));

  // Centralized JSON error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  const host = '0.0.0.0';
  createApp().listen(port, host, () => {
    console.log(`Bookmark Manager listening on http://${host}:${port}`);
  });
}
