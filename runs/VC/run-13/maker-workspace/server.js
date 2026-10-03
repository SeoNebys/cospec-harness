import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, 'data'), { recursive: true });

const {
  listBookmarks,
  getBookmark,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  allTags,
} = await import('./db.js');

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function validate(body) {
  const errors = [];
  const title = (body.title ?? '').toString().trim();
  let url = (body.url ?? '').toString().trim();
  if (!title) errors.push('Title is required.');
  if (!url) {
    errors.push('URL is required.');
  } else {
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      new URL(url);
    } catch {
      errors.push('URL is not valid.');
    }
  }
  return { errors, title, url };
}

app.get('/api/bookmarks', (req, res) => {
  const { search, tag, favorite } = req.query;
  res.json(
    listBookmarks({
      search: search || '',
      tag: tag || '',
      favorite: favorite === '1' || favorite === 'true',
    })
  );
});

app.get('/api/tags', (req, res) => {
  res.json(allTags());
});

app.get('/api/bookmarks/:id', (req, res) => {
  const bm = getBookmark(Number(req.params.id));
  if (!bm) return res.status(404).json({ error: 'Not found' });
  res.json(bm);
});

app.post('/api/bookmarks', (req, res) => {
  const { errors, title, url } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const bm = createBookmark({
    title,
    url,
    description: (req.body.description ?? '').toString().trim(),
    tags: req.body.tags ?? '',
    favorite: !!req.body.favorite,
  });
  res.status(201).json(bm);
});

app.put('/api/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getBookmark(id)) return res.status(404).json({ error: 'Not found' });
  const { errors, title, url } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const bm = updateBookmark(id, {
    title,
    url,
    description: (req.body.description ?? '').toString().trim(),
    tags: req.body.tags ?? '',
    favorite: !!req.body.favorite,
  });
  res.json(bm);
});

app.patch('/api/bookmarks/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  const bm = getBookmark(id);
  if (!bm) return res.status(404).json({ error: 'Not found' });
  res.json(updateBookmark(id, { favorite: !bm.favorite }));
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const ok = deleteBookmark(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
