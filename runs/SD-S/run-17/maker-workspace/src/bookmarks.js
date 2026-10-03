// Bookmark data-access and business rules (data-model.md, contracts/api.md).
// Depends on db.js (storage), url.js (validate/normalise/dedupe), and
// title-fetch.js (best-effort auto-title).

import { getDb } from './db.js';
import { normalize, dedupeKey } from './url.js';
import { fetchTitle } from './title-fetch.js';

/** Error carrying an HTTP status + machine code for the API layer. */
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function nowIso() {
  // Full ISO-8601 with millisecond precision so quick successive edits produce
  // distinct updated_at values and ordering stays stable.
  return new Date().toISOString();
}

// ---- Tag helpers -----------------------------------------------------------

function normalizeTags(tags) {
  if (tags == null) return [];
  if (!Array.isArray(tags)) {
    throw new ApiError(400, 'invalid_tags', 'Tags must be a list of labels.');
  }
  const seen = new Map(); // lowercased -> original trimmed
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()];
}

function upsertTag(db, name) {
  const existing = db
    .prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tags(name) VALUES (?)').run(name);
  return info.lastInsertRowid;
}

function setBookmarkTags(db, bookmarkId, tagNames) {
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id) VALUES (?, ?)'
  );
  for (const name of tagNames) {
    link.run(bookmarkId, upsertTag(db, name));
  }
  pruneOrphanTags(db);
}

function pruneOrphanTags(db) {
  db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)'
  ).run();
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

function toResource(db, row) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    notes: row.notes,
    tags: tagsFor(db, row.id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---- Create (US1) ----------------------------------------------------------

/**
 * Create a bookmark. Normalises + validates the address, auto-fetches a title
 * when none is supplied, detects duplicates, and persists.
 * @returns {Promise<object>} the created Bookmark resource
 * @throws {ApiError} 400 invalid address, 409 duplicate without confirm
 */
export async function create({ url, title, notes, tags, confirmDuplicate } = {}) {
  const db = getDb();

  let normalizedUrl;
  try {
    normalizedUrl = normalize(url);
  } catch (e) {
    throw new ApiError(400, 'invalid_url', e.message);
  }

  const key = dedupeKey(normalizedUrl);
  const cleanTags = normalizeTags(tags);
  const cleanNotes = typeof notes === 'string' ? notes.trim() : '';

  if (!confirmDuplicate) {
    const dup = db
      .prepare('SELECT id FROM bookmarks WHERE url_key = ?')
      .get(key);
    if (dup) {
      throw new ApiError(
        409,
        'already_saved',
        'This address is already saved. Save it again anyway?',
        { existingId: dup.id }
      );
    }
  }

  // Resolve the title: user-provided wins; else best-effort fetch; else address.
  let resolvedTitle = typeof title === 'string' ? title.trim() : '';
  if (resolvedTitle === '') {
    const fetched = await fetchTitle(normalizedUrl);
    resolvedTitle = fetched && fetched.trim() !== '' ? fetched.trim() : normalizedUrl;
  }

  const ts = nowIso();
  const insert = db.prepare(
    `INSERT INTO bookmarks(url, title, notes, url_key, created_at, updated_at)
     VALUES (@url, @title, @notes, @url_key, @created_at, @updated_at)`
  );

  const tx = db.transaction(() => {
    const info = insert.run({
      url: normalizedUrl,
      title: resolvedTitle,
      notes: cleanNotes,
      url_key: key,
      created_at: ts,
      updated_at: ts,
    });
    setBookmarkTags(db, info.lastInsertRowid, cleanTags);
    return info.lastInsertRowid;
  });

  const id = tx();
  return getById(id);
}

// ---- Read / list (US2, US4) ------------------------------------------------

/** @returns {object|null} */
export function getById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return row ? toResource(db, row) : null;
}

/**
 * List bookmarks newest-first, with optional search term (q) and tag filter.
 * @param {{q?: string, tag?: string}} options
 * @returns {{bookmarks: object[], total: number, matched: number}}
 */
export function list({ q, tag } = {}) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) AS n FROM bookmarks').get().n;

  const where = [];
  const params = {};

  if (typeof tag === 'string' && tag.trim() !== '') {
    where.push(`b.id IN (
      SELECT bt.bookmark_id FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE t.name = @tag COLLATE NOCASE
    )`);
    params.tag = tag.trim();
  }

  if (typeof q === 'string' && q.trim() !== '') {
    params.q = `%${q.trim().toLowerCase()}%`;
    where.push(`(
      LOWER(b.title) LIKE @q OR
      LOWER(b.url) LIKE @q OR
      LOWER(b.notes) LIKE @q OR
      b.id IN (
        SELECT bt.bookmark_id FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE LOWER(t.name) LIKE @q
      )
    )`);
  }

  const sql =
    `SELECT b.* FROM bookmarks b` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY b.created_at DESC, b.id DESC`;

  const rows = db.prepare(sql).all(params);
  const bookmarks = rows.map((r) => toResource(db, r));
  return { bookmarks, total, matched: bookmarks.length };
}

/** @returns {string[]} existing tag names */
export function listTags() {
  const db = getDb();
  return db
    .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE')
    .all()
    .map((r) => r.name);
}

// ---- Update / delete (US3) -------------------------------------------------

/**
 * Update fields of an existing bookmark. Any of url/title/notes/tags may be
 * provided. Refreshes updated_at. Re-validates url when supplied.
 * @returns {object} the updated resource
 * @throws {ApiError} 404 not found, 400 invalid url
 */
export function update(id, fields = {}) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'not_found', 'Bookmark not found.');

  const next = {
    url: existing.url,
    title: existing.title,
    notes: existing.notes,
    url_key: existing.url_key,
  };

  if (fields.url !== undefined) {
    let normalizedUrl;
    try {
      normalizedUrl = normalize(fields.url);
    } catch (e) {
      throw new ApiError(400, 'invalid_url', e.message);
    }
    next.url = normalizedUrl;
    next.url_key = dedupeKey(normalizedUrl);
  }

  if (fields.title !== undefined) {
    const t = typeof fields.title === 'string' ? fields.title.trim() : '';
    next.title = t === '' ? next.url : t;
  }

  if (fields.notes !== undefined) {
    next.notes = typeof fields.notes === 'string' ? fields.notes.trim() : '';
  }

  const ts = nowIso();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE bookmarks
       SET url = @url, title = @title, notes = @notes, url_key = @url_key,
           updated_at = @updated_at
       WHERE id = @id`
    ).run({ ...next, updated_at: ts, id });

    if (fields.tags !== undefined) {
      setBookmarkTags(db, id, normalizeTags(fields.tags));
    }
  });
  tx();

  return getById(id);
}

/**
 * Permanently delete a bookmark.
 * @throws {ApiError} 404 not found
 */
export function remove(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  if (info.changes === 0) {
    throw new ApiError(404, 'not_found', 'Bookmark not found.');
  }
  pruneOrphanTags(db);
}
