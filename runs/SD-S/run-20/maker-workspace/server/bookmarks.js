import { getDb } from './db.js';

const MAX_TITLE_LEN = 2048;

// Signals a validation failure that maps to an HTTP 400 invalid_url response.
export class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Signals a missing bookmark that maps to an HTTP 404 not_found response.
export class NotFoundError extends Error {
  constructor(message = 'Bookmark does not exist.') {
    super(message);
    this.code = 'not_found';
  }
}

// VR-1/VR-2: normalize and validate a web address. Prepend https:// when no
// scheme is present, then accept only http/https URLs.
export function normalizeUrl(rawInput) {
  const input = typeof rawInput === 'string' ? rawInput.trim() : '';
  if (!input) {
    throw new ValidationError('invalid_url', 'Enter a valid web address.');
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input);
  const candidate = hasScheme ? input : `https://${input}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ValidationError('invalid_url', 'Enter a valid web address.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('invalid_url', 'Enter a valid web address.');
  }
  // Require a host so entries like "https://" alone are rejected.
  if (!parsed.hostname) {
    throw new ValidationError('invalid_url', 'Enter a valid web address.');
  }

  return parsed.toString();
}

// VR-3: default a blank title to the normalized url; cap stored length.
function normalizeTitle(rawTitle, normalizedUrl) {
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  const effective = title || normalizedUrl;
  return effective.slice(0, MAX_TITLE_LEN);
}

// VR-4: trim, lowercase, drop empties, and dedupe tags (order preserved).
function normalizeTags(rawTags) {
  if (rawTags == null) return [];
  const list = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags).split(',');
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const tag = String(item).trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function rowToBookmark(row) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    tags: JSON.parse(row.tags_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// FR-001/VR-6: create a bookmark. Returns { bookmark, warning? } where warning
// is 'duplicate_url' when the normalized url already exists (non-blocking).
export function createBookmark(input = {}) {
  const db = getDb();
  const url = normalizeUrl(input.url);
  const title = normalizeTitle(input.title, url);
  const tags = normalizeTags(input.tags);
  const now = new Date().toISOString();

  const existing = db
    .prepare('SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1')
    .get(url);

  const info = db
    .prepare(
      `INSERT INTO bookmarks (url, title, tags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(url, title, JSON.stringify(tags), now, now);

  const bookmark = getBookmark(info.lastInsertRowid);
  const result = { bookmark };
  if (existing) result.warning = 'duplicate_url';
  return result;
}

export function getBookmark(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return row ? rowToBookmark(row) : null;
}

// FR-005/FR-010/FR-011: list bookmarks newest-first, with optional case-
// insensitive substring search over title+url and exact tag membership (AND).
export function listBookmarks({ q, tag } = {}) {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM bookmarks ORDER BY created_at DESC, id DESC')
    .all();
  let bookmarks = rows.map(rowToBookmark);

  const term = typeof q === 'string' ? q.trim().toLowerCase() : '';
  if (term) {
    bookmarks = bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(term) ||
        b.url.toLowerCase().includes(term)
    );
  }

  const wantedTag = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
  if (wantedTag) {
    bookmarks = bookmarks.filter((b) => b.tags.includes(wantedTag));
  }

  return { bookmarks, total: bookmarks.length };
}

// FR-010: distinct tags across all bookmarks, sorted, for the filter control.
export function listTags() {
  const db = getDb();
  const rows = db.prepare('SELECT tags_json FROM bookmarks').all();
  const set = new Set();
  for (const row of rows) {
    for (const tag of JSON.parse(row.tags_json)) set.add(tag);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// FR-007: partial update of url/title/tags with the same validation rules;
// refreshes updated_at. Throws NotFoundError when the id is absent.
export function updateBookmark(id, input = {}) {
  const db = getDb();
  const current = getBookmark(id);
  if (!current) throw new NotFoundError();

  let url = current.url;
  if (input.url !== undefined) {
    url = normalizeUrl(input.url);
  }

  let title = current.title;
  if (input.title !== undefined) {
    title = normalizeTitle(input.title, url);
  } else if (input.url !== undefined && current.title === current.url) {
    // If title had defaulted to the old url and only the url changed, keep it
    // aligned with the new url.
    title = normalizeTitle('', url);
  }

  let tags = current.tags;
  if (input.tags !== undefined) {
    tags = normalizeTags(input.tags);
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE bookmarks SET url = ?, title = ?, tags_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(url, title, JSON.stringify(tags), now, id);

  return getBookmark(id);
}

// FR-008: permanently delete. Throws NotFoundError when the id is absent.
export function deleteBookmark(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  if (info.changes === 0) throw new NotFoundError();
}
