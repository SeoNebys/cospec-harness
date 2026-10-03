const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bookmarks.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeTags(tags) {
  if (Array.isArray(tags)) tags = tags.join(',');
  return String(tags || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

function serialize(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
  };
}

app.get('/api/bookmarks', (req, res) => {
  const { q, tag } = req.query;
  let rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC').all();
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.url.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle) ||
        r.tags.toLowerCase().includes(needle)
    );
  }
  if (tag) {
    const t = String(tag).toLowerCase();
    rows = rows.filter((r) => r.tags.split(',').includes(t));
  }
  res.json(rows.map(serialize));
});

app.get('/api/tags', (req, res) => {
  const rows = db.prepare('SELECT tags FROM bookmarks').all();
  const counts = {};
  for (const r of rows) {
    for (const t of r.tags.split(',').filter(Boolean)) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  res.json(
    Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  );
});

app.post('/api/bookmarks', (req, res) => {
  let { url, title, description, tags } = req.body || {};
  if (!url || !String(url).trim()) {
    return res.status(400).json({ error: 'URL is required' });
  }
  url = String(url).trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  title = (title && String(title).trim()) || url;
  const info = db
    .prepare(
      'INSERT INTO bookmarks (url, title, description, tags, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(url, title, String(description || '').trim(), normalizeTags(tags), new Date().toISOString());
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

app.put('/api/bookmarks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  let { url, title, description, tags } = req.body || {};
  url = (url && String(url).trim()) || existing.url;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  title = (title && String(title).trim()) || url;
  db.prepare(
    'UPDATE bookmarks SET url = ?, title = ?, description = ?, tags = ? WHERE id = ?'
  ).run(url, title, String(description || '').trim(), normalizeTags(tags), req.params.id);
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  res.json(serialize(row));
});

app.delete('/api/bookmarks/:id', (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
