import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  listBookmarks,
  createBookmark,
  getBookmark,
  updateBookmark,
  deleteBookmark,
  allTags,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function validate(body) {
  const errors = [];
  const url = String(body.url || '').trim();
  const title = String(body.title || '').trim();
  if (!url) errors.push('url is required');
  else if (!/^https?:\/\/.+/i.test(url)) errors.push('url must start with http:// or https://');
  if (!title) errors.push('title is required');
  return {
    errors,
    value: {
      url,
      title,
      description: String(body.description || '').trim(),
      tags: body.tags || '',
    },
  };
}

app.get('/api/bookmarks', (req, res) => {
  const { search = '', tag = '' } = req.query;
  res.json(listBookmarks({ search, tag }));
});

app.get('/api/tags', (_req, res) => {
  res.json(allTags());
});

app.get('/api/bookmarks/:id', (req, res) => {
  const bookmark = getBookmark(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ errors: ['not found'] });
  res.json(bookmark);
});

app.post('/api/bookmarks', (req, res) => {
  const { errors, value } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  res.status(201).json(createBookmark(value));
});

app.put('/api/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getBookmark(id)) return res.status(404).json({ errors: ['not found'] });
  const { errors, value } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  res.json(updateBookmark(id, value));
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!deleteBookmark(id)) return res.status(404).json({ errors: ['not found'] });
  res.status(204).end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
