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
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function validateUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  let value = url.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return value;
  } catch {
    return null;
  }
}

app.get('/api/bookmarks', (req, res) => {
  const { search = '', tag = '', favorite } = req.query;
  const bookmarks = listBookmarks({
    search: String(search),
    tag: String(tag),
    favorite: favorite === '1' || favorite === 'true',
  });
  res.json(bookmarks);
});

app.get('/api/tags', (req, res) => {
  res.json(allTags());
});

app.get('/api/bookmarks/:id', (req, res) => {
  const bookmark = getBookmark(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: 'Bookmark not found' });
  res.json(bookmark);
});

app.post('/api/bookmarks', (req, res) => {
  const { url, title, description, tags, favorite } = req.body || {};
  const validUrl = validateUrl(url);
  if (!validUrl) return res.status(400).json({ error: 'A valid URL is required' });
  const finalTitle = (title && String(title).trim()) || validUrl;
  const bookmark = createBookmark({
    url: validUrl,
    title: finalTitle,
    description: description ? String(description) : '',
    tags: tags || [],
    favorite: !!favorite,
  });
  res.status(201).json(bookmark);
});

app.put('/api/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  const { url, title, description, tags, favorite } = req.body || {};
  const fields = {};
  if (url !== undefined) {
    const validUrl = validateUrl(url);
    if (!validUrl) return res.status(400).json({ error: 'A valid URL is required' });
    fields.url = validUrl;
  }
  if (title !== undefined) fields.title = String(title);
  if (description !== undefined) fields.description = String(description);
  if (tags !== undefined) fields.tags = tags;
  if (favorite !== undefined) fields.favorite = !!favorite;
  const bookmark = updateBookmark(id, fields);
  if (!bookmark) return res.status(404).json({ error: 'Bookmark not found' });
  res.json(bookmark);
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const ok = deleteBookmark(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Bookmark not found' });
  res.status(204).end();
});

app.listen(PORT, HOST, () => {
  console.log(`Bookmark manager listening on http://${HOST}:${PORT}`);
});
