const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bookmarks.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeTags(tags) {
  if (!tags) return '';
  return String(tags)
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

function rowToBookmark(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
  };
}

app.get('/api/bookmarks', (req, res) => {
  const { q, tag } = req.query;
  let sql = 'SELECT * FROM bookmarks';
  const clauses = [];
  const params = [];
  if (q) {
    clauses.push('(title LIKE ? OR url LIKE ? OR description LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (tag) {
    clauses.push('(","||tags||"," LIKE ?)');
    params.push(`%,${String(tag).trim().toLowerCase()},%`);
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(rowToBookmark));
});

app.get('/api/tags', (req, res) => {
  const rows = db.prepare('SELECT tags FROM bookmarks').all();
  const counts = {};
  for (const row of rows) {
    for (const t of (row.tags || '').split(',').filter(Boolean)) {
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
  const { title, url, description, tags } = req.body || {};
  if (!url || !String(url).trim()) return res.status(400).json({ error: 'URL is required' });
  const finalTitle = (title && String(title).trim()) || String(url).trim();
  const info = db
    .prepare('INSERT INTO bookmarks (title, url, description, tags, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(finalTitle, String(url).trim(), String(description || '').trim(), normalizeTags(tags), new Date().toISOString());
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToBookmark(row));
});

app.put('/api/bookmarks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title, url, description, tags } = req.body || {};
  if (!url || !String(url).trim()) return res.status(400).json({ error: 'URL is required' });
  db.prepare('UPDATE bookmarks SET title = ?, url = ?, description = ?, tags = ? WHERE id = ?').run(
    (title && String(title).trim()) || String(url).trim(),
    String(url).trim(),
    String(description || '').trim(),
    normalizeTags(tags),
    req.params.id
  );
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  res.json(rowToBookmark(row));
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
