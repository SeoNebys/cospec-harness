import { getDb, transaction } from '../db.js';

// ---- Validation & normalization (FR-001, FR-002) ----

// Validate that a value is a well-formed http/https web address.
export function isValidUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

// Normalize a URL for duplicate detection: trim, lowercase scheme + host,
// drop a trailing slash on the path. Query and fragment are preserved.
export function normalizeUrl(value) {
  const parsed = new URL(value.trim());
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  let path = parsed.pathname;
  if (path === '/') {
    path = '';
  } else if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`;
}

export class ValidationError extends Error {}
export class DuplicateError extends Error {
  constructor(message, existingId) {
    super(message);
    this.existingId = existingId;
  }
}
export class NotFoundError extends Error {}

// ---- Tag helpers (FR-012) ----

function normalizeTagNames(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Map(); // lowercased -> original trimmed
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (name === '') continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}

function upsertTag(db, name) {
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
  return db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name).id;
}

function setBookmarkTags(db, bookmarkId, tagNames) {
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  for (const name of tagNames) {
    const tagId = upsertTag(db, name);
    link.run(bookmarkId, tagId);
  }
}

function tagsForBookmark(db, bookmarkId) {
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
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    tags: tagsForBookmark(db, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Create (FR-001, FR-003, FR-011) ----

// deriveTitle is injected so the route can pass the title fetcher; tests can
// stub it. It receives the url and returns a title string (may fall back to url).
export async function createBookmark({ url, title, tags }, deriveTitle) {
  if (!isValidUrl(url)) {
    throw new ValidationError('A valid web address is required.');
  }
  const db = getDb();
  const normalized = normalizeUrl(url);

  const existing = db
    .prepare('SELECT id FROM bookmarks WHERE url_normalized = ?')
    .get(normalized);
  if (existing) {
    throw new DuplicateError('This address is already bookmarked.', existing.id);
  }

  let finalTitle = typeof title === 'string' ? title.trim() : '';
  if (finalTitle === '') {
    finalTitle = deriveTitle ? await deriveTitle(url.trim()) : url.trim();
  }
  if (!finalTitle) finalTitle = url.trim();

  const now = new Date().toISOString();
  const tagNames = normalizeTagNames(tags);

  const insert = db.prepare(
    `INSERT INTO bookmarks (url, url_normalized, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  const id = transaction(() => {
    const info = insert.run(url.trim(), normalized, finalTitle, now, now);
    const newId = Number(info.lastInsertRowid);
    setBookmarkTags(db, newId, tagNames);
    return newId;
  });

  return getBookmark(id);
}

// ---- Read (FR-006, FR-007, FR-012) ----

export function getBookmark(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return row ? toApi(db, row) : null;
}

export function listBookmarks({ q, tag } = {}) {
  const db = getDb();
  const clauses = [];
  const params = [];

  if (tag && tag.trim() !== '') {
    clauses.push(
      `b.id IN (
        SELECT bt.bookmark_id FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.name = ? COLLATE NOCASE
      )`
    );
    params.push(tag.trim());
  }

  if (q && q.trim() !== '') {
    clauses.push('(b.title LIKE ? OR b.url LIKE ?)');
    const like = `%${q.trim()}%`;
    params.push(like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`)
    .all(...params);
  return rows.map((row) => toApi(db, row));
}

// ---- Update (FR-004, FR-009, FR-012) ----

export function updateBookmark(id, { title, tags }) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!row) throw new NotFoundError('Bookmark not found.');

  const now = new Date().toISOString();

  transaction(() => {
    if (typeof title === 'string') {
      const trimmed = title.trim();
      const finalTitle = trimmed === '' ? row.url : trimmed;
      db.prepare('UPDATE bookmarks SET title = ?, updated_at = ? WHERE id = ?').run(
        finalTitle,
        now,
        id
      );
    } else {
      db.prepare('UPDATE bookmarks SET updated_at = ? WHERE id = ?').run(now, id);
    }
    if (tags !== undefined) {
      setBookmarkTags(db, id, normalizeTagNames(tags));
    }
  });

  return getBookmark(id);
}

// ---- Delete (FR-010) ----

export function deleteBookmark(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  if (info.changes === 0) throw new NotFoundError('Bookmark not found.');
}

// ---- Tags listing (FR-012) ----

export function listTags() {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all()
    .map((r) => r.name);
}
