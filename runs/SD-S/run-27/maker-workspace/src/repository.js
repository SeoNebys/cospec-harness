import { getDb } from './db.js';
import {
  normalizeAddress,
  normalizeText,
  normalizeTags,
} from './lib/validation.js';

class ValidationError extends Error {}
class NotFoundError extends Error {}

export { ValidationError, NotFoundError };

function nowIso() {
  return new Date().toISOString();
}

// Insert missing tags and return their ids for the given normalized names.
function upsertTags(db, names) {
  const ids = [];
  const insert = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const select = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
  for (const name of names) {
    insert.run(name);
    const row = select.get(name);
    ids.push(row.id);
  }
  return ids;
}

function setBookmarkTags(db, bookmarkId, names) {
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const ids = upsertTags(db, names);
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  for (const id of ids) link.run(bookmarkId, id);
}

// Remove tags that are no longer referenced by any bookmark.
function pruneOrphanTags(db) {
  db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)'
  ).run();
}

function tagsForBookmark(db, bookmarkId) {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId);
  return rows.map((r) => r.name);
}

function toBookmark(db, row) {
  if (!row) return null;
  return {
    id: row.id,
    address: row.address,
    title: row.title,
    note: row.note,
    tags: tagsForBookmark(db, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getBookmarkById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return toBookmark(db, row);
}

export function createBookmark(input = {}) {
  const db = getDb();

  const addr = normalizeAddress(input.address);
  if (!addr.ok) throw new ValidationError(addr.error);

  const title = normalizeText(input.title);
  const note = normalizeText(input.note);
  const tags = normalizeTags(input.tags);

  // Non-blocking duplicate detection (FR-011).
  const existing = db
    .prepare('SELECT id FROM bookmarks WHERE address = ? ORDER BY id LIMIT 1')
    .get(addr.address);
  const duplicateOf = existing ? existing.id : null;

  const ts = nowIso();
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO bookmarks (address, title, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(addr.address, title, note, ts, ts);
    const id = result.lastInsertRowid;
    setBookmarkTags(db, id, tags);
    return id;
  });
  const id = tx();

  return { bookmark: getBookmarkById(id), duplicateOf };
}

export function listBookmarks({ q, tag } = {}) {
  const db = getDb();
  const clauses = [];
  const params = [];

  if (tag && tag.trim()) {
    clauses.push(
      `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt
                JOIN tags t ON t.id = bt.tag_id
                WHERE t.name = ? COLLATE NOCASE)`
    );
    params.push(tag.trim());
  }

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    clauses.push(
      `(b.title LIKE ? OR b.address LIKE ? OR b.note LIKE ?
        OR b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt
                    JOIN tags t ON t.id = bt.tag_id
                    WHERE t.name LIKE ?))`
    );
    params.push(like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT * FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`
    )
    .all(...params);
  return rows.map((row) => toBookmark(db, row));
}

export function listTags() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
  return rows.map((r) => r.name);
}

export function updateBookmark(id, input = {}) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Bookmark not found.');

  let address = existing.address;
  if (input.address !== undefined) {
    const addr = normalizeAddress(input.address);
    if (!addr.ok) throw new ValidationError(addr.error);
    address = addr.address;
  }

  const title =
    input.title !== undefined ? normalizeText(input.title) : existing.title;
  const note =
    input.note !== undefined ? normalizeText(input.note) : existing.note;

  const ts = nowIso();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE bookmarks SET address = ?, title = ?, note = ?, updated_at = ?
       WHERE id = ?`
    ).run(address, title, note, ts, id);

    if (input.tags !== undefined) {
      setBookmarkTags(db, id, normalizeTags(input.tags));
      pruneOrphanTags(db);
    }
  });
  tx();

  return getBookmarkById(id);
}

export function deleteBookmark(id) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM bookmarks WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Bookmark not found.');

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    pruneOrphanTags(db);
  });
  tx();
}
