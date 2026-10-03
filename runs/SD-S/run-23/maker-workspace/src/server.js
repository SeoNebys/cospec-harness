import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb } from './db.js';
import { createStore } from './bookmarks.js';
import { createApiRouter } from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(store) {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(store));
  app.use(express.static(join(__dirname, '..', 'public')));

  // JSON error fallback so unexpected errors don't leak HTML stack traces.
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// Start only when run directly (not when imported by tests).
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const db = createDb(process.env.DB_FILE || 'data/bookmarks.db');
  // Test flag: skip live metadata fetching for deterministic e2e runs.
  const storeOpts =
    process.env.SKIP_METADATA === '1'
      ? { collect: async () => ({ title: '', description: '', faviconUrl: '' }) }
      : {};
  const store = createStore(db, storeOpts);
  const app = createApp(store);
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${port}`);
  });
}
