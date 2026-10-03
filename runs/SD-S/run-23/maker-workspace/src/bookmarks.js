import { collectMetadata } from './metadata.js';

// --- URL normalization / validation (FR-002, FR-003) ---

export function normalizeUrl(input) {
  if (input == null) throw new ValidationError('An address is required');
  let raw = String(input).trim();
  if (!raw) throw new ValidationError('An address is required');
  // Assume https:// when no scheme is provided (FR-003).
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    raw = 'https://' + raw;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError('That address is not a valid web link');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Only http and https addresses are supported');
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new ValidationError('That address is not a valid web link');
  }
  return parsed.href;
}

export class ValidationError extends Error {}
export class ConflictError extends Error {
  constructor(message, existingId) {
    super(message);
    this.existingId = existingId;
  }
}
export class NotFoundError extends Error {}

// --- Tag normalization (FR-015) ---

export function normalizeTagName(name) {
  return String(name ?? '').trim();
}
export function tagKey(name) {
  return normalizeTagName(name).toLowerCase();
}

// --- Data access layer ---

export function createStore(db, { collect = collectMetadata } = {}) {
  const now = () => new Date().toISOString();

  // Cache prepared statements: reused across calls (better perf) and, being
  // strongly referenced for the store's lifetime, they are finalized cleanly by
  // db.close() rather than churned and GC-collected during process teardown.
  const stmtCache = new Map();
  const prep = (sql) => {
    let s = stmtCache.get(sql);
    if (!s) {
      s = db.prepare(sql);
      stmtCache.set(sql, s);
    }
    return s;
  };

  // node:sqlite has no db.transaction() helper; wrap manually.
  const transaction = (fn) => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  function tagsForBookmark(id) {
    return prep(
        `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ?
         ORDER BY t.name COLLATE NOCASE`
      )
      .all(id)
      .map((r) => r.name);
  }

  function shape(row) {
    if (!row) return null;
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      faviconUrl: row.favicon_url,
      tags: tagsForBookmark(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function upsertTag(name) {
    const display = normalizeTagName(name);
    const key = tagKey(name);
    if (!key) return null;
    const existing = prep('SELECT id FROM tags WHERE norm_key = ?').get(key);
    if (existing) return existing.id;
    const info = prep('INSERT INTO tags (name, norm_key) VALUES (?, ?)')
      .run(display, key);
    return Number(info.lastInsertRowid);
  }

  function setTags(bookmarkId, names) {
    prep('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    if (!Array.isArray(names)) return;
    const seen = new Set();
    const link = prep(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    );
    for (const name of names) {
      const key = tagKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const tagId = upsertTag(name);
      if (tagId) link.run(bookmarkId, tagId);
    }
  }

  const store = {
    getById(id) {
      const row = prep('SELECT * FROM bookmarks WHERE id = ?').get(id);
      return shape(row);
    },

    getByUrl(url) {
      const row = prep('SELECT * FROM bookmarks WHERE url = ?').get(url);
      return shape(row);
    },

    // Create a bookmark. Returns { bookmark, existed }.
    async create({ url, tags, title, description, faviconUrl }) {
      const normUrl = normalizeUrl(url);
      const existing = prep('SELECT * FROM bookmarks WHERE url = ?').get(normUrl);
      if (existing) {
        return { bookmark: shape(existing), existed: true }; // FR-019
      }

      // Auto-collect metadata unless the caller supplied overrides (FR-004, FR-005).
      const meta = await collect(normUrl);
      const host = new URL(normUrl).hostname;
      const finalTitle =
        (title != null && String(title).trim()) || meta.title || host; // FR-006
      const finalDesc = description != null ? String(description) : meta.description;
      const finalIcon = faviconUrl != null ? String(faviconUrl) : meta.faviconUrl;

      const ts = now();
      const id = transaction(() => {
        const info = prep(
            `INSERT INTO bookmarks (url, title, description, favicon_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(normUrl, finalTitle, finalDesc, finalIcon, ts, ts);
        const newId = Number(info.lastInsertRowid);
        setTags(newId, tags);
        return newId;
      });
      return { bookmark: store.getById(id), existed: false };
    },

    list({ q, tag } = {}) {
      const clauses = [];
      const params = [];
      if (tag && tagKey(tag)) {
        clauses.push(
          `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt
                    JOIN tags t ON t.id = bt.tag_id WHERE t.norm_key = ?)`
        );
        params.push(tagKey(tag));
      }
      if (q && String(q).trim()) {
        const like = `%${String(q).trim().toLowerCase()}%`;
        clauses.push(
          `(LOWER(b.title) LIKE ? OR LOWER(b.description) LIKE ? OR LOWER(b.url) LIKE ?
            OR b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt
                        JOIN tags t ON t.id = bt.tag_id WHERE t.norm_key LIKE ?))`
        );
        params.push(like, like, like, like);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = prep(`SELECT * FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`)
        .all(...params);
      return rows.map(shape);
    },

    update(id, fields) {
      const current = prep('SELECT * FROM bookmarks WHERE id = ?').get(id);
      if (!current) throw new NotFoundError('Bookmark not found');

      let newUrl = current.url;
      if (fields.url !== undefined) {
        newUrl = normalizeUrl(fields.url);
        const clash = prep('SELECT id FROM bookmarks WHERE url = ? AND id != ?')
          .get(newUrl, id);
        if (clash) {
          throw new ConflictError(
            'A bookmark with that address already exists',
            clash.id
          ); // FR-019
        }
      }
      const title = fields.title !== undefined ? String(fields.title) : current.title;
      const description =
        fields.description !== undefined ? String(fields.description) : current.description;
      const faviconUrl =
        fields.faviconUrl !== undefined ? String(fields.faviconUrl) : current.favicon_url;

      transaction(() => {
        prep(
          `UPDATE bookmarks SET url = ?, title = ?, description = ?, favicon_url = ?, updated_at = ?
           WHERE id = ?`
        ).run(newUrl, title, description, faviconUrl, now(), id);
        if (fields.tags !== undefined) setTags(id, fields.tags);
      });
      return store.getById(id);
    },

    remove(id) {
      const info = prep('DELETE FROM bookmarks WHERE id = ?').run(id);
      if (Number(info.changes) === 0) throw new NotFoundError('Bookmark not found');
    },

    listTags() {
      return prep('SELECT name FROM tags ORDER BY name COLLATE NOCASE')
        .all()
        .map((r) => r.name);
    },

    close() {
      db.close();
    },
  };

  return store;
}
