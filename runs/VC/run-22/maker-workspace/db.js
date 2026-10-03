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
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    tags        TEXT    NOT NULL DEFAULT '',
    favorite    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );
`);

const now = () => new Date().toISOString();

// tags are stored as a comma-separated string; expose as an array to callers.
function rowToBookmark(row) {
  if (!row) return null;
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
  return [...new Set(
    list.map((t) => t.trim().toLowerCase()).filter(Boolean)
  )].join(',');
}

export function listBookmarks({ search = '', tag = '', favorite = false } = {}) {
  const clauses = [];
  const params = {};
  if (search) {
    clauses.push('(LOWER(title) LIKE :q OR LOWER(url) LIKE :q OR LOWER(description) LIKE :q OR LOWER(tags) LIKE :q)');
    params.q = `%${search.toLowerCase()}%`;
  }
  if (tag) {
    clauses.push("(',' || tags || ',') LIKE :tag");
    params.tag = `%,${tag.toLowerCase()},%`;
  }
  if (favorite) {
    clauses.push('favorite = 1');
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const stmt = db.prepare(
    `SELECT * FROM bookmarks ${where} ORDER BY favorite DESC, datetime(updated_at) DESC`
  );
  return stmt.all(params).map(rowToBookmark);
}

export function getBookmark(id) {
  return rowToBookmark(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
}

export function createBookmark({ url, title, description = '', tags = [], favorite = false }) {
  const ts = now();
  const stmt = db.prepare(`
    INSERT INTO bookmarks (url, title, description, tags, favorite, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    url.trim(),
    title.trim(),
    description.trim(),
    normalizeTags(tags),
    favorite ? 1 : 0,
    ts,
    ts
  );
  return getBookmark(info.lastInsertRowid);
}

export function updateBookmark(id, fields) {
  const existing = getBookmark(id);
  if (!existing) return null;
  const url = fields.url !== undefined ? fields.url.trim() : existing.url;
  const title = fields.title !== undefined ? fields.title.trim() : existing.title;
  const description = fields.description !== undefined ? fields.description.trim() : existing.description;
  const tags = fields.tags !== undefined ? normalizeTags(fields.tags) : existing.tags.join(',');
  const favorite = fields.favorite !== undefined ? (fields.favorite ? 1 : 0) : (existing.favorite ? 1 : 0);
  db.prepare(`
    UPDATE bookmarks
    SET url = ?, title = ?, description = ?, tags = ?, favorite = ?, updated_at = ?
    WHERE id = ?
  `).run(url, title, description, tags, favorite, now(), id);
  return getBookmark(id);
}

export function deleteBookmark(id) {
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return info.changes > 0;
}

export function allTags() {
  const rows = db.prepare("SELECT tags FROM bookmarks WHERE tags != ''").all();
  const counts = new Map();
  for (const row of rows) {
    for (const tag of row.tags.split(',').filter(Boolean)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export default db;
