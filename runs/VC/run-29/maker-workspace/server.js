const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bookmarks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readAll() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function normalizeUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return 'https://' + trimmed;
  return trimmed;
}

// List with optional search (q) and tag filter
app.get('/api/bookmarks', (req, res) => {
  let items = readAll();
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const tag = (req.query.tag || '').toString().trim().toLowerCase();

  if (q) {
    items = items.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q) ||
        b.tags.some((t) => t.includes(q))
    );
  }
  if (tag) {
    items = items.filter((b) => b.tags.includes(tag));
  }
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(items);
});

// Distinct tags with counts
app.get('/api/tags', (req, res) => {
  const counts = {};
  for (const b of readAll()) {
    for (const t of b.tags) counts[t] = (counts[t] || 0) + 1;
  }
  const tags = Object.keys(counts)
    .sort()
    .map((name) => ({ name, count: counts[name] }));
  res.json(tags);
});

app.post('/api/bookmarks', (req, res) => {
  const url = normalizeUrl(req.body.url);
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const now = new Date().toISOString();
  const bookmark = {
    id: crypto.randomUUID(),
    url,
    title: (req.body.title || '').toString().trim() || url,
    description: (req.body.description || '').toString().trim(),
    tags: normalizeTags(req.body.tags),
    createdAt: now,
    updatedAt: now,
  };
  const items = readAll();
  items.push(bookmark);
  writeAll(items);
  res.status(201).json(bookmark);
});

app.put('/api/bookmarks/:id', (req, res) => {
  const items = readAll();
  const idx = items.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const b = items[idx];
  if (req.body.url !== undefined) {
    const url = normalizeUrl(req.body.url);
    if (!url) return res.status(400).json({ error: 'URL is required' });
    b.url = url;
  }
  if (req.body.title !== undefined) b.title = req.body.title.toString().trim() || b.url;
  if (req.body.description !== undefined) b.description = req.body.description.toString().trim();
  if (req.body.tags !== undefined) b.tags = normalizeTags(req.body.tags);
  b.updatedAt = new Date().toISOString();

  items[idx] = b;
  writeAll(items);
  res.json(b);
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const items = readAll();
  const next = items.filter((b) => b.id !== req.params.id);
  if (next.length === items.length) return res.status(404).json({ error: 'Not found' });
  writeAll(next);
  res.status(204).end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
