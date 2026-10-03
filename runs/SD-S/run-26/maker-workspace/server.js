// App entry: Express server for the Bookmark Manager.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './src/db.js';
import { errorMiddleware } from './src/util/errors.js';
import bookmarksRouter from './src/routes/bookmarks.js';
import snapshotsRouter from './src/routes/snapshots.js';
import portingRouter from './src/routes/porting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Captured assets (favicons, thumbnails) served as static files.
  app.use('/assets/favicons', express.static(path.join(DATA_DIR, 'favicons')));
  app.use('/assets/thumbnails', express.static(path.join(DATA_DIR, 'thumbnails')));

  // API. Snapshot router shares the /api/bookmarks mount (distinct sub-path).
  app.use('/api/bookmarks', snapshotsRouter);
  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api', portingRouter);

  // Static UI.
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(errorMiddleware);
  return app;
}

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

// Start only when run directly (not when imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
  });
}
