import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'bookmarks.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// tags are stored as a comma-separated, normalized string (e.g. "news,dev").
export function normalizeTags(input) {
  if (!input) return '';
  const list = Array.isArray(input) ? input : String(input).split(',');
  const seen = new Set();
  for (const raw of list) {
    const t = raw.trim().toLowerCase();
    if (t) seen.add(t);
  }
  return [...seen].join(',');
}

function rowToBookmark(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',') : [],
  };
}

export function listBookmarks({ search = '', tag = '' } = {}) {
  const clauses = [];
  const params = {};
  if (search) {
    clauses.push('(title LIKE @q OR url LIKE @q OR description LIKE @q OR tags LIKE @q)');
    params.q = `%${search}%`;
  }
  if (tag) {
    clauses.push("(',' || tags || ',') LIKE @tag");
    params.tag = `%,${tag.trim().toLowerCase()},%`;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM bookmarks ${where} ORDER BY created_at DESC, id DESC`)
    .all(params);
  return rows.map(rowToBookmark);
}

export function allTags() {
  const rows = db.prepare('SELECT tags FROM bookmarks').all();
  const counts = new Map();
  for (const { tags } of rows) {
    if (!tags) continue;
    for (const t of tags.split(',')) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createBookmark({ url, title, description = '', tags = '' }) {
  const info = db
    .prepare(
      'INSERT INTO bookmarks (url, title, description, tags) VALUES (@url, @title, @description, @tags)'
    )
    .run({ url, title, description, tags: normalizeTags(tags) });
  return getBookmark(info.lastInsertRowid);
}

export function getBookmark(id) {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return row ? rowToBookmark(row) : null;
}

export function updateBookmark(id, { url, title, description = '', tags = '' }) {
  db.prepare(
    `UPDATE bookmarks SET url = @url, title = @title, description = @description, tags = @tags WHERE id = @id`
  ).run({ id, url, title, description, tags: normalizeTags(tags) });
  return getBookmark(id);
}

export function deleteBookmark(id) {
  return db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
}
