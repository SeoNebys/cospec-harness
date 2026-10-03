import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

// --- Database ---------------------------------------------------------------
const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'bookmarks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '',
    favorite    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
`);

// --- Helpers ----------------------------------------------------------------
function normalizeTags(input) {
  if (!input) return '';
  const arr = Array.isArray(input) ? input : String(input).split(',');
  const cleaned = [...new Set(
    arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
  )];
  return cleaned.join(',');
}

function normalizeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://' + u;
}

function rowToBookmark(row) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    tags: row.tags ? row.tags.split(',') : [],
    favorite: !!row.favorite,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// --- App --------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// List with optional search / tag / favorite filters
app.get('/api/bookmarks', (req, res) => {
  const { q, tag, favorite } = req.query;
  let sql = 'SELECT * FROM bookmarks WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (title LIKE ? OR url LIKE ? OR description LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (tag) {
    // match a whole tag within the comma list
    sql += " AND (',' || tags || ',') LIKE ?";
    params.push(`%,${String(tag).toLowerCase()},%`);
  }
  if (favorite === 'true') sql += ' AND favorite = 1';
  sql += ' ORDER BY favorite DESC, datetime(created_at) DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(rowToBookmark));
});

// Distinct tags with counts
app.get('/api/tags', (_req, res) => {
  const rows = db.prepare('SELECT tags FROM bookmarks').all();
  const counts = new Map();
  for (const r of rows) {
    if (!r.tags) continue;
    for (const t of r.tags.split(',')) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const tags = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  res.json(tags);
});

app.post('/api/bookmarks', (req, res) => {
  const url = normalizeUrl(req.body.url);
  if (!url) return res.status(400).json({ error: 'A URL is required.' });
  const title = String(req.body.title || '').trim() || url;
  const description = String(req.body.description || '').trim();
  const tags = normalizeTags(req.body.tags);
  const favorite = req.body.favorite ? 1 : 0;
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO bookmarks (url, title, description, tags, favorite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(url, title, description, tags, favorite, now, now);
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToBookmark(row));
});

app.put('/api/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Bookmark not found.' });
  const url = req.body.url !== undefined ? normalizeUrl(req.body.url) : existing.url;
  if (!url) return res.status(400).json({ error: 'A URL is required.' });
  const title =
    req.body.title !== undefined
      ? String(req.body.title).trim() || url
      : existing.title;
  const description =
    req.body.description !== undefined
      ? String(req.body.description).trim()
      : existing.description;
  const tags = req.body.tags !== undefined ? normalizeTags(req.body.tags) : existing.tags;
  const favorite =
    req.body.favorite !== undefined ? (req.body.favorite ? 1 : 0) : existing.favorite;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE bookmarks SET url=?, title=?, description=?, tags=?, favorite=?, updated_at=? WHERE id=?`
  ).run(url, title, description, tags, favorite, now, id);
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  res.json(rowToBookmark(row));
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Bookmark not found.' });
  res.status(204).end();
});

app.listen(PORT, HOST, () => {
  console.log(`Bookmark manager running at http://${HOST}:${PORT}`);
});
