import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'bookmarks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function rowToBookmark(row) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    favorite: !!row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTags(tags) {
  if (!tags) return '';
  const list = Array.isArray(tags)
    ? tags
    : String(tags).split(',');
  return list
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .join(',');
}

export function listBookmarks({ search = '', tag = '', favorite = false } = {}) {
  let sql = 'SELECT * FROM bookmarks WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (title LIKE ? OR url LIKE ? OR description LIKE ? OR tags LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (tag) {
    sql += ' AND (tags = ? OR tags LIKE ? OR tags LIKE ? OR tags LIKE ?)';
    const t = tag.trim().toLowerCase();
    params.push(t, `${t},%`, `%,${t},%`, `%,${t}`);
  }
  if (favorite) {
    sql += ' AND favorite = 1';
  }
  sql += ' ORDER BY favorite DESC, datetime(created_at) DESC';
  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToBookmark);
}

export function getBookmark(id) {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return row ? rowToBookmark(row) : null;
}

export function createBookmark({ url, title, description = '', tags = '', favorite = false }) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO bookmarks (url, title, description, tags, favorite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(url, title, description, normalizeTags(tags), favorite ? 1 : 0, now, now);
  return getBookmark(result.lastInsertRowid);
}

export function updateBookmark(id, { url, title, description, tags, favorite }) {
  const existing = getBookmark(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE bookmarks
     SET url = ?, title = ?, description = ?, tags = ?, favorite = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    url ?? existing.url,
    title ?? existing.title,
    description ?? existing.description,
    tags !== undefined ? normalizeTags(tags) : existing.tags.join(','),
    favorite !== undefined ? (favorite ? 1 : 0) : existing.favorite ? 1 : 0,
    now,
    id
  );
  return getBookmark(id);
}

export function deleteBookmark(id) {
  const result = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function allTags() {
  const rows = db.prepare("SELECT tags FROM bookmarks WHERE tags != ''").all();
  const counts = {};
  for (const row of rows) {
    for (const tag of row.tags.split(',').filter(Boolean)) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
