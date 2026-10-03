import { normalizeUrl } from '../services/url.js';
import { fallbackFromAddress, fetchPageTitle } from '../services/title.js';

/**
 * Raised when an address collides with an existing bookmark. Carries the
 * existing bookmark's id (and whether it is archived) so callers can route the
 * user to it for editing instead of creating a duplicate (FR-010).
 */
export class DuplicateAddressError extends Error {
  constructor(existing) {
    super('A bookmark with this address already exists.');
    this.name = 'DuplicateAddressError';
    this.existingId = existing.id;
    this.existingArchived = !!existing.is_archived;
  }
}

export class NotFoundError extends Error {
  constructor() {
    super('Bookmark not found.');
    this.name = 'NotFoundError';
  }
}

export class BookmarkStore {
  constructor(db) {
    this.db = db;
    this.#stmtCache = new Map();
  }

  #stmtCache;

  // Prepare a statement once and reuse it. Reusing statements (rather than
  // re-preparing on every call) is faster and avoids leaking many Statement
  // objects that would otherwise be finalized late.
  #stmt(sql) {
    let s = this.#stmtCache.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.#stmtCache.set(sql, s);
    }
    return s;
  }

  // ---- serialization -------------------------------------------------------

  #tagsFor(id) {
    return this.#stmt(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ? ORDER BY t.name`
    )
      .all(id)
      .map((r) => r.name);
  }

  #serialize(row) {
    return {
      id: row.id,
      address: row.address,
      title: row.title,
      description: row.description || '',
      tags: this.#tagsFor(row.id),
      isRead: !!row.is_read,
      isArchived: !!row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  #findByAddress(address) {
    return this.#stmt('SELECT * FROM bookmarks WHERE address = ?').get(address);
  }

  #setTags(bookmarkId, tags) {
    this.#stmt('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    if (!Array.isArray(tags)) return;
    const insertTag = this.#stmt('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTag = this.#stmt('SELECT id FROM tags WHERE name = ?');
    const link = this.#stmt(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    );
    const seen = new Set();
    for (const raw of tags) {
      const name = String(raw).trim().toLowerCase();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      insertTag.run(name);
      const { id } = getTag.get(name);
      link.run(bookmarkId, id);
    }
  }

  // ---- reads ---------------------------------------------------------------

  get(id) {
    const row = this.#stmt('SELECT * FROM bookmarks WHERE id = ?').get(id);
    if (!row) throw new NotFoundError();
    return this.#serialize(row);
  }

  /**
   * List bookmarks for a view ('active' | 'unread' | 'archive'), optionally
   * filtered by keyword (q) and/or tag. Newest first.
   */
  list({ view = 'active', q = '', tag = '' } = {}) {
    const where = [];
    const params = [];

    if (view === 'unread') {
      where.push('b.is_archived = 0', 'b.is_read = 0');
    } else if (view === 'archive') {
      where.push('b.is_archived = 1');
    } else {
      where.push('b.is_archived = 0');
    }

    if (tag && tag.trim()) {
      where.push(
        `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt
                  JOIN tags t ON t.id = bt.tag_id WHERE t.name = ?)`
      );
      params.push(tag.trim().toLowerCase());
    }

    if (q && q.trim()) {
      const like = `%${q.trim().toLowerCase()}%`;
      where.push(
        `(LOWER(b.title) LIKE ? OR LOWER(b.address) LIKE ? OR LOWER(b.description) LIKE ?
          OR b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt
                      JOIN tags t ON t.id = bt.tag_id WHERE t.name LIKE ?))`
      );
      params.push(like, like, like, like);
    }

    const sql = `SELECT b.* FROM bookmarks b
                 WHERE ${where.join(' AND ')}
                 ORDER BY b.created_at DESC, b.id DESC`;
    return this.#stmt(sql)
      .all(...params)
      .map((row) => this.#serialize(row));
  }

  allTags() {
    return this.#stmt('SELECT DISTINCT name FROM tags ORDER BY name')
      .all()
      .map((r) => r.name);
  }

  // ---- writes --------------------------------------------------------------

  /**
   * Create a bookmark. Validates/normalizes the address, enforces uniqueness
   * (throwing DuplicateAddressError with the existing id), derives a title when
   * none is given, and defaults to unread + active.
   */
  async create({ address, title, description = '', tags = [] } = {}) {
    const normalized = normalizeUrl(address);

    const existing = this.#findByAddress(normalized);
    if (existing) throw new DuplicateAddressError(existing);

    let finalTitle = (title || '').trim();
    if (!finalTitle) {
      finalTitle = (await fetchPageTitle(normalized)) || fallbackFromAddress(normalized);
    }

    const now = new Date().toISOString();
    const info = this.#stmt(
      `INSERT INTO bookmarks (address, title, description, is_read, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)`
    ).run(normalized, finalTitle, description || '', now, now);

    this.#setTags(info.lastInsertRowid, tags);
    return this.get(info.lastInsertRowid);
  }

  /**
   * Update editable fields: address, title, description, tags, isRead,
   * isArchived. A changed address is re-validated and de-duplicated (FR-006,
   * FR-010).
   */
  update(id, fields = {}) {
    const row = this.#stmt('SELECT * FROM bookmarks WHERE id = ?').get(id);
    if (!row) throw new NotFoundError();

    const sets = [];
    const params = [];

    if (fields.address !== undefined) {
      const normalized = normalizeUrl(fields.address);
      const other = this.#findByAddress(normalized);
      if (other && other.id !== row.id) throw new DuplicateAddressError(other);
      sets.push('address = ?');
      params.push(normalized);
    }
    if (fields.title !== undefined) {
      const t = String(fields.title).trim();
      sets.push('title = ?');
      params.push(t || fallbackFromAddress(fields.address || row.address));
    }
    if (fields.description !== undefined) {
      sets.push('description = ?');
      params.push(String(fields.description));
    }
    if (fields.isRead !== undefined) {
      sets.push('is_read = ?');
      params.push(fields.isRead ? 1 : 0);
    }
    if (fields.isArchived !== undefined) {
      sets.push('is_archived = ?');
      params.push(fields.isArchived ? 1 : 0);
    }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    this.db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    if (fields.tags !== undefined) this.#setTags(id, fields.tags);

    return this.get(id);
  }

  remove(id) {
    const info = this.#stmt('DELETE FROM bookmarks WHERE id = ?').run(id);
    if (info.changes === 0) throw new NotFoundError();
  }
}
