import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBookmark,
  listBookmarks,
  getBookmark,
  updateBookmark,
  deleteBookmark,
  listTags,
} from './bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const api = express.Router();

// GET /api/bookmarks?search=&tag=
api.get('/bookmarks', (req, res) => {
  const bookmarks = listBookmarks({ search: req.query.search, tag: req.query.tag });
  res.json({ bookmarks });
});

// POST /api/bookmarks
api.post('/bookmarks', (req, res) => {
  const { address, tags } = req.body || {};
  const result = createBookmark(address, tags);
  if (result.error) return res.status(400).json({ error: result.error });
  if (result.existing) return res.status(200).json({ bookmark: result.bookmark, existing: true });
  res.status(201).json({ bookmark: result.bookmark });
});

// GET /api/bookmarks/:id
api.get('/bookmarks/:id', (req, res) => {
  const bookmark = getBookmark(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json({ bookmark });
});

// PUT /api/bookmarks/:id
api.put('/bookmarks/:id', (req, res) => {
  const { address, title, description, tags } = req.body || {};
  const result = updateBookmark(Number(req.params.id), { address, title, description, tags });
  if (result.notFound) return res.status(404).json({ error: 'Bookmark not found.' });
  if (result.error) return res.status(400).json({ error: result.error });
  if (result.conflict) {
    return res.status(409).json({ error: 'That address is already bookmarked.', existingId: result.existingId });
  }
  res.json({ bookmark: result.bookmark });
});

// DELETE /api/bookmarks/:id
api.delete('/bookmarks/:id', (req, res) => {
  const result = deleteBookmark(Number(req.params.id));
  if (result.notFound) return res.status(404).json({ error: 'Bookmark not found.' });
  res.status(204).end();
});

// GET /api/tags
api.get('/tags', (_req, res) => {
  res.json({ tags: listTags() });
});

app.use('/api', api);

// Export the app for tests; only listen when run directly.
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
  });
}

export default app;
