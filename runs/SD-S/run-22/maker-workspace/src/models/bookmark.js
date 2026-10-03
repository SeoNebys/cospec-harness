import { getDb } from '../db/index.js';

// Data access for bookmarks and their tags.
// See specs/001-bookmark-manager/data-model.md.

function nowIso() {
  return new Date().toISOString();
}

function normalizeTagName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

/** Upsert a tag by (case-insensitive) name and return its id. */
function upsertTag(db, rawName) {
  const name = normalizeTagName(rawName);
  if (name === '') return null;
  const existing = db
    .prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  return info.lastInsertRowid;
}

/** Replace the full tag set for a bookmark. */
function setTags(db, bookmarkId, tags) {
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  const seen = new Set();
  for (const raw of tags || []) {
    const name = normalizeTagName(raw).toLowerCase();
    if (name === '' || seen.has(name)) continue;
    seen.add(name);
    const tagId = upsertTag(db, raw);
    if (tagId != null) link.run(bookmarkId, tagId);
  }
}

function tagsFor(db, bookmarkId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

function toApi(db, row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    note: row.note ?? null,
    tags: tagsFor(db, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Find a bookmark whose url exactly matches (used for duplicate detection). */
export function findByUrl(url) {
  const db = getDb();
  return db.prepare('SELECT * FROM bookmarks WHERE url = ?').get(url) || null;
}

/** Create a bookmark with its tags. Returns the API-shaped bookmark. */
export function create({ url, title, note = null, tags = [] }) {
  const db = getDb();
  const ts = nowIso();
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        'INSERT INTO bookmarks (url, title, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(url, title, note ?? null, ts, ts);
    const id = info.lastInsertRowid;
    setTags(db, id, tags);
    return id;
  });
  const id = tx();
  return getById(id);
}

/** Fetch a single bookmark by id, or null. */
export function getById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return toApi(db, row);
}

/**
 * List bookmarks newest-first, optionally filtered by keyword and/or tag.
 * Keyword matches title, url, or any tag name.
 */
export function list({ q, tag } = {}) {
  const db = getDb();
  const clauses = [];
  const params = [];

  if (q && q.trim() !== '') {
    const like = `%${q.trim()}%`;
    clauses.push(
      `(b.title LIKE ? OR b.url LIKE ? OR EXISTS (
         SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
         WHERE bt.bookmark_id = b.id AND t.name LIKE ?))`
    );
    params.push(like, like, like);
  }

  if (tag && tag.trim() !== '') {
    clauses.push(
      `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
               WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`
    );
    params.push(tag.trim());
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT b.* FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`)
    .all(...params);
  return rows.map((row) => toApi(db, row));
}

/** All distinct tag names, alphabetical. */
export function listTags() {
  const db = getDb();
  return db
    .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE')
    .all()
    .map((r) => r.name);
}

/**
 * Update title/note/tags of a bookmark. url is not editable (FR-007).
 * Returns the updated bookmark, or null if it does not exist.
 */
export function update(id, { title, note, tags }) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!existing) return null;

  const tx = db.transaction(() => {
    const newTitle = title !== undefined ? title : existing.title;
    const newNote = note !== undefined ? note : existing.note;
    db.prepare(
      'UPDATE bookmarks SET title = ?, note = ?, updated_at = ? WHERE id = ?'
    ).run(newTitle, newNote ?? null, nowIso(), id);
    if (tags !== undefined) setTags(db, id, tags);
  });
  tx();
  return getById(id);
}

/** Delete a bookmark. Returns true if a row was removed. */
export function remove(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return info.changes > 0;
}
