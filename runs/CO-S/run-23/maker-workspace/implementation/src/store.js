const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function uniqueTags(tags) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(tags) ? tags : []) {
    const tag = String(value).trim();
    const key = tag.toLocaleLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      result.push(tag.slice(0, 60));
    }
  }
  return result;
}

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    canonicalUrl: row.canonical_url,
    title: row.title,
    description: row.description,
    source: row.source,
    tags: JSON.parse(row.tags_json),
    readLater: Boolean(row.read_later),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class BookmarkStore {
  constructor(dbPath) {
    if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        canonical_url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        read_later INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  all() {
    return this.db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC, id DESC').all().map(hydrate);
  }

  get(id) {
    return hydrate(this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
  }

  findByCanonical(canonicalUrl, excludingId = null) {
    const row = excludingId === null
      ? this.db.prepare('SELECT * FROM bookmarks WHERE canonical_url = ?').get(canonicalUrl)
      : this.db.prepare('SELECT * FROM bookmarks WHERE canonical_url = ? AND id != ?').get(canonicalUrl, excludingId);
    return hydrate(row);
  }

  create(input) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO bookmarks (url, canonical_url, title, description, source, tags_json, read_later, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.url,
      input.canonicalUrl,
      input.title,
      input.description || '',
      input.source,
      JSON.stringify(uniqueTags(input.tags)),
      input.readLater ? 1 : 0,
      now,
      now
    );
    return this.get(Number(result.lastInsertRowid));
  }

  update(id, input) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE bookmarks
      SET url = ?, canonical_url = ?, title = ?, description = ?, source = ?, tags_json = ?, read_later = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.url,
      input.canonicalUrl,
      input.title,
      input.description || '',
      input.source,
      JSON.stringify(uniqueTags(input.tags)),
      input.readLater ? 1 : 0,
      now,
      id
    );
    return this.get(id);
  }

  delete(id) {
    return this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
  }

  close() {
    this.db.close();
  }
}

module.exports = { BookmarkStore, uniqueTags };
