// Express app: serves the browser client from public/ and a JSON REST API
// under /api. Binds 0.0.0.0:4000 for the review environment. (contracts/api.md)

import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createStore } from './bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(store) {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  // GET /api/bookmarks?q=&tag=
  api.get('/bookmarks', (req, res) => {
    const { q, tag } = req.query;
    res.json({ bookmarks: store.listBookmarks({ q, tag }) });
  });

  // POST /api/bookmarks
  api.post('/bookmarks', (req, res) => {
    try {
      const result = store.createBookmark(req.body || {});
      res.status(201).json(result);
    } catch (err) {
      if (err.code === 'INVALID_URL') return res.status(400).json({ error: 'Invalid URL' });
      throw err;
    }
  });

  // PUT /api/bookmarks/:id
  api.put('/bookmarks/:id', (req, res) => {
    try {
      const updated = store.updateBookmark(Number(req.params.id), req.body || {});
      if (!updated) return res.status(404).json({ error: 'Bookmark not found' });
      res.json({ bookmark: updated });
    } catch (err) {
      if (err.code === 'INVALID_URL') return res.status(400).json({ error: 'Invalid URL' });
      throw err;
    }
  });

  // DELETE /api/bookmarks/:id
  api.delete('/bookmarks/:id', (req, res) => {
    const removed = store.deleteBookmark(Number(req.params.id));
    if (!removed) return res.status(404).json({ error: 'Bookmark not found' });
    res.status(204).end();
  });

  // GET /api/tags
  api.get('/tags', (_req, res) => {
    res.json({ tags: store.listTags() });
  });

  app.use('/api', api);
  app.use(express.static(join(__dirname, '..', 'public')));

  // JSON error handler (contracts/api.md error shape).
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// Start the server unless this module is imported (e.g. by tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const db = openDb();
  const app = createApp(createStore(db));
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${port}`);
  });
}
