import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bookmarksRouter from './routes/bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', bookmarksRouter);
  app.use(express.static(join(__dirname, '..', 'public')));

  // Central error handler -> JSON { error }.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  createApp().listen(port, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${port}`);
  });
}
