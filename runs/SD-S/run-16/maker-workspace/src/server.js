import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bookmarksRouter from './routes/bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

export function createApp() {
  const app = express();
  app.use(express.json());

  // JSON API
  app.use('/api', bookmarksRouter);

  // Static frontend
  app.use(express.static(PUBLIC_DIR));

  // Centralized error handler -> { error, message }
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong.' });
  });

  return app;
}

// Start only when run directly (not when imported by tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${PORT}`);
  });
}
