// Express app: JSON API + static frontend + error handling (contracts/api.md).
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRepository } from './bookmarks.repo.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { tagsRouter } from './routes/tags.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const STATUS_BY_CODE = {
  invalid_url: 400,
  validation_error: 400,
  duplicate_url: 409,
  not_found: 404,
};

export function createApp(db, options = {}) {
  const repo = createRepository(db, options);
  const app = express();

  app.use(express.json());

  // Test-only helper to reset state between end-to-end tests. Never enabled in
  // production; guarded by an explicit env flag set only by the test runner.
  if (process.env.ENABLE_TEST_RESET === '1') {
    app.post('/api/test/reset', (_req, res) => {
      db.exec('DELETE FROM bookmark_tags; DELETE FROM bookmarks; DELETE FROM tags;');
      res.status(204).end();
    });
  }

  app.use('/api/bookmarks', bookmarksRouter(repo));
  app.use('/api/tags', tagsRouter(repo));

  app.use(express.static(PUBLIC_DIR));

  // JSON error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const code = err.code && STATUS_BY_CODE[err.code] ? err.code : 'validation_error';
    const status = STATUS_BY_CODE[code] || 500;
    if (!STATUS_BY_CODE[err.code]) {
      // Unexpected error — log for diagnostics.
      console.error(err);
    }
    res.status(status).json({ error: { code, message: err.message || 'Request failed.' } });
  });

  return app;
}
