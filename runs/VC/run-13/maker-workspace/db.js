import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(join(__dirname, 'data', 'bookmarks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
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
    title: row.title,
    url: row.url,
    description: row.description,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    favorite: !!row.favorite,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
    .filter((t, i, a) => a.indexOf(t) === i)
    .join(',');
}

export function listBookmarks({ search = '', tag = '', favorite = false } = {}) {
  let sql = 'SELECT * FROM bookmarks';
  const clauses = [];
  const params = {};
  if (search) {
    clauses.push('(title LIKE $q OR url LIKE $q OR description LIKE $q OR tags LIKE $q)');
    params.$q = `%${search}%`;
  }
  if (tag) {
    clauses.push('(tags = $tag OR tags LIKE $tagStart OR tags LIKE $tagMid OR tags LIKE $tagEnd)');
    params.$tag = tag;
    params.$tagStart = `${tag},%`;
    params.$tagMid = `%,${tag},%`;
    params.$tagEnd = `%,${tag}`;
  }
  if (favorite) {
    clauses.push('favorite = 1');
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY favorite DESC, datetime(created_at) DESC';
  const rows = db.prepare(sql).all(params);
  return rows.map(rowToBookmark);
}

export function getBookmark(id) {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return row ? rowToBookmark(row) : null;
}

export function createBookmark({ title, url, description = '', tags = '', favorite = false }) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO bookmarks (title, url, description, tags, favorite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, url, description, normalizeTags(tags), favorite ? 1 : 0, now, now);
  return getBookmark(info.lastInsertRowid);
}

export function updateBookmark(id, fields) {
  const existing = getBookmark(id);
  if (!existing) return null;
  const merged = {
    title: fields.title ?? existing.title,
    url: fields.url ?? existing.url,
    description: fields.description ?? existing.description,
    tags: fields.tags !== undefined ? normalizeTags(fields.tags) : existing.tags.join(','),
    favorite: fields.favorite !== undefined ? (fields.favorite ? 1 : 0) : (existing.favorite ? 1 : 0),
  };
  db.prepare(
    `UPDATE bookmarks SET title=?, url=?, description=?, tags=?, favorite=?, updated_at=? WHERE id=?`
  ).run(merged.title, merged.url, merged.description, merged.tags, merged.favorite, new Date().toISOString(), id);
  return getBookmark(id);
}

export function deleteBookmark(id) {
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return info.changes > 0;
}

export function allTags() {
  const rows = db.prepare("SELECT tags FROM bookmarks WHERE tags != ''").all();
  const counts = {};
  for (const row of rows) {
    for (const t of row.tags.split(',').filter(Boolean)) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
