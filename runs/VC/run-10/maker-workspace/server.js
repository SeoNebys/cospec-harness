import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listBookmarks,
  getBookmark,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  allTags,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function normalizeUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function validate(body) {
  const errors = [];
  const url = normalizeUrl(body.url);
  if (!url) errors.push('URL is required.');
  else {
    try {
      new URL(url);
    } catch {
      errors.push('URL is not valid.');
    }
  }
  const title = String(body.title || '').trim();
  if (!title) errors.push('Title is required.');
  return { errors, url, title };
}

app.get('/api/bookmarks', (req, res) => {
  const { search = '', tag = '', favorite } = req.query;
  res.json(
    listBookmarks({
      search: String(search),
      tag: String(tag),
      favorite: favorite === 'true' || favorite === '1',
    })
  );
});

app.get('/api/tags', (_req, res) => {
  res.json(allTags());
});

app.get('/api/bookmarks/:id', (req, res) => {
  const bookmark = getBookmark(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json(bookmark);
});

app.post('/api/bookmarks', (req, res) => {
  const { errors, url, title } = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const bookmark = createBookmark({
    url,
    title,
    description: String(req.body.description || '').trim(),
    tags: req.body.tags || '',
    favorite: !!req.body.favorite,
  });
  res.status(201).json(bookmark);
});

app.put('/api/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getBookmark(id)) return res.status(404).json({ error: 'Bookmark not found.' });
  const { errors, url, title } = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const bookmark = updateBookmark(id, {
    url,
    title,
    description: String(req.body.description || '').trim(),
    tags: req.body.tags || '',
    favorite: !!req.body.favorite,
  });
  res.json(bookmark);
});

app.patch('/api/bookmarks/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  const existing = getBookmark(id);
  if (!existing) return res.status(404).json({ error: 'Bookmark not found.' });
  const bookmark = updateBookmark(id, { favorite: !existing.favorite });
  res.json(bookmark);
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const ok = deleteBookmark(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Bookmark not found.' });
  res.status(204).end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
