// Express application: serves the browser UI from public/ and the JSON API under
// /api, backed by src/bookmarks.js. Binds 0.0.0.0:4000 for the review harness.
// See specs/001-bookmark-manager/contracts/api.md for the contract.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ApiError,
  create,
  getById,
  list,
  listTags,
  update,
  remove,
} from './bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

export function createApp() {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  // Wrap async handlers so rejections reach the error middleware.
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // GET /api/bookmarks?q=&tag=  (FR-006, FR-011, FR-012, FR-013)
  api.get(
    '/bookmarks',
    wrap((req, res) => {
      const { q, tag } = req.query;
      res.json(list({ q, tag }));
    })
  );

  // GET /api/bookmarks/:id
  api.get(
    '/bookmarks/:id',
    wrap((req, res) => {
      const bm = getById(Number(req.params.id));
      if (!bm) throw new ApiError(404, 'not_found', 'Bookmark not found.');
      res.json(bm);
    })
  );

  // POST /api/bookmarks  (FR-001..004, FR-010, FR-014)
  api.post(
    '/bookmarks',
    wrap(async (req, res) => {
      const created = await create(req.body || {});
      res.status(201).json(created);
    })
  );

  // PUT /api/bookmarks/:id  (FR-008)
  api.put(
    '/bookmarks/:id',
    wrap((req, res) => {
      const updated = update(Number(req.params.id), req.body || {});
      res.json(updated);
    })
  );

  // DELETE /api/bookmarks/:id  (FR-009)
  api.delete(
    '/bookmarks/:id',
    wrap((req, res) => {
      remove(Number(req.params.id));
      res.status(204).end();
    })
  );

  // GET /api/tags  (FR-012)
  api.get(
    '/tags',
    wrap((req, res) => {
      res.json({ tags: listTags() });
    })
  );

  app.use('/api', api);

  // Static UI.
  app.use(express.static(PUBLIC_DIR));

  // Centralised error handler → { error, message } (contracts/api.md).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({
        error: err.code,
        message: err.message,
        ...err.extra,
      });
    }
    console.error(err);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong.' });
  });

  return app;
}

// Start the server unless imported by a test.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${port}`);
  });
}
