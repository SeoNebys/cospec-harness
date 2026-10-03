import { normalizeUrl, deriveTitleFromUrl } from './validation.js';

/**
 * Data access layer over the SQLite database. All bookmark reads return a
 * bookmark shaped for the API (see contracts/rest-api.md), including tag names.
 */
export class Repository {
  constructor(db) {
    this.db = db;
  }

  // ---- Bookmarks ----

  /**
   * Create a bookmark. Throws a DuplicateError (carrying the existing bookmark)
   * when the normalized URL already exists (FR-009).
   */
  createBookmark({ url, title, note, tags }) {
    const normalized = normalizeUrl(url);
    const existing = this.db
      .prepare('SELECT id FROM bookmarks WHERE normalized_url = ?')
      .get(normalized);
    if (existing) {
      const err = new DuplicateError('This address is already bookmarked.');
      err.existing = this.getBookmark(existing.id);
      throw err;
    }

    const now = new Date().toISOString();
    const displayTitle = (title && title.trim()) || deriveTitleFromUrl(url);
    const titleLocked = title && title.trim() ? 1 : 0;

    const info = this.db
      .prepare(
        `INSERT INTO bookmarks
          (url, normalized_url, title, description, favicon_url, preview_url,
           note, enrichment_status, title_locked, description_locked,
           created_at, updated_at)
         VALUES (@url, @normalized, @title, NULL, NULL, NULL, @note,
                 'pending', @titleLocked, 0, @now, @now)`
      )
      .run({
        url: url.trim(),
        normalized,
        title: displayTitle,
        note: note && note.trim() ? note.trim() : null,
        titleLocked,
        now,
      });

    const id = info.lastInsertRowid;
    if (Array.isArray(tags) && tags.length > 0) {
      this.setTags(id, tags);
    }
    return this.getBookmark(id);
  }

  getBookmark(id) {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    if (!row) return null;
    return this.#shape(row);
  }

  listBookmarks({ q, tag } = {}) {
    const clauses = [];
    const params = {};

    if (tag && tag.trim()) {
      clauses.push(`b.id IN (
        SELECT bt.bookmark_id FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.name_lower = @tagLower
      )`);
      params.tagLower = tag.trim().toLowerCase();
    }

    if (q && q.trim()) {
      const like = `%${q.trim().toLowerCase()}%`;
      params.like = like;
      clauses.push(`(
        LOWER(b.title) LIKE @like OR
        LOWER(b.url) LIKE @like OR
        LOWER(COALESCE(b.description, '')) LIKE @like OR
        LOWER(COALESCE(b.note, '')) LIKE @like OR
        b.id IN (
          SELECT bt.bookmark_id FROM bookmark_tags bt
          JOIN tags t ON t.id = bt.tag_id
          WHERE t.name_lower LIKE @like
        )
      )`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT b.* FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`)
      .all(params);
    return rows.map((r) => this.#shape(r));
  }

  /**
   * Update editable fields (FR-012). Any provided field overrides auto-filled
   * values and locks that field against future enrichment refreshes.
   * Throws DuplicateError on a URL collision with a different bookmark.
   */
  updateBookmark(id, fields) {
    const existing = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    if (!existing) return null;

    const sets = [];
    const params = { id };

    if (fields.url !== undefined) {
      const normalized = normalizeUrl(fields.url);
      const clash = this.db
        .prepare('SELECT id FROM bookmarks WHERE normalized_url = ? AND id != ?')
        .get(normalized, id);
      if (clash) {
        const err = new DuplicateError('Another bookmark already uses this address.');
        err.existing = this.getBookmark(clash.id);
        throw err;
      }
      sets.push('url = @url', 'normalized_url = @normalized');
      params.url = fields.url.trim();
      params.normalized = normalized;
    }
    if (fields.title !== undefined) {
      sets.push('title = @title', 'title_locked = 1');
      params.title = fields.title.trim() || deriveTitleFromUrl(fields.url || existing.url);
    }
    if (fields.description !== undefined) {
      sets.push('description = @description', 'description_locked = 1');
      params.description = fields.description.trim() || null;
    }
    if (fields.note !== undefined) {
      sets.push('note = @note');
      params.note = fields.note.trim() || null;
    }

    if (sets.length > 0) {
      sets.push('updated_at = @now');
      params.now = new Date().toISOString();
      this.db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }

    if (fields.tags !== undefined) {
      this.setTags(id, fields.tags);
    }
    return this.getBookmark(id);
  }

  /**
   * Store enrichment results without overwriting fields the user has edited
   * (FR-008, FR-013). `fields` may include title, description, faviconUrl,
   * previewUrl. `status` is 'done' or 'failed'.
   */
  updateEnrichment(id, fields, status) {
    const existing = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    if (!existing) return null;

    const sets = ['enrichment_status = @status', 'updated_at = @now'];
    const params = { id, status, now: new Date().toISOString() };

    if (fields.title && !existing.title_locked) {
      sets.push('title = @title');
      params.title = fields.title;
    }
    if (fields.description && !existing.description_locked) {
      sets.push('description = @description');
      params.description = fields.description;
    }
    if (fields.faviconUrl) {
      sets.push('favicon_url = @favicon');
      params.favicon = fields.faviconUrl;
    }
    if (fields.previewUrl) {
      sets.push('preview_url = @preview');
      params.preview = fields.previewUrl;
    }

    this.db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = @id`).run(params);
    return this.getBookmark(id);
  }

  deleteBookmark(id) {
    const info = this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    return info.changes > 0;
  }

  // ---- Tags ----

  /**
   * Replace a bookmark's tags with the given names (FR-010). Tags are reused
   * case-insensitively (FR-011); empty/whitespace names are ignored.
   */
  setTags(bookmarkId, names) {
    const clean = [];
    const seen = new Set();
    for (const raw of names || []) {
      if (typeof raw !== 'string') continue;
      const name = raw.trim();
      if (!name) continue;
      const lower = name.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      clean.push(name);
    }

    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
      const findTag = this.db.prepare('SELECT id FROM tags WHERE name_lower = ?');
      const insertTag = this.db.prepare('INSERT INTO tags (name, name_lower) VALUES (?, ?)');
      const link = this.db.prepare(
        'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
      );
      for (const name of clean) {
        const lower = name.toLowerCase();
        let row = findTag.get(lower);
        if (!row) {
          const info = insertTag.run(name, lower);
          row = { id: info.lastInsertRowid };
        }
        link.run(bookmarkId, row.id);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  listTagNames(prefix) {
    if (prefix && prefix.trim()) {
      const like = `${prefix.trim().toLowerCase()}%`;
      return this.db
        .prepare('SELECT name FROM tags WHERE name_lower LIKE ? ORDER BY name_lower')
        .all(like)
        .map((r) => r.name);
    }
    return this.db
      .prepare('SELECT name FROM tags ORDER BY name_lower')
      .all()
      .map((r) => r.name);
  }

  #tagsFor(bookmarkId) {
    return this.db
      .prepare(
        `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ?
         ORDER BY t.name_lower`
      )
      .all(bookmarkId)
      .map((r) => r.name);
  }

  #shape(row) {
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      faviconUrl: row.favicon_url,
      previewUrl: row.preview_url,
      note: row.note,
      tags: this.#tagsFor(row.id),
      enrichmentStatus: row.enrichment_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class DuplicateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DuplicateError';
    this.code = 'duplicate';
  }
}
