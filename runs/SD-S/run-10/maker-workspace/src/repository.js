// Data access for bookmarks and tags (data-model.md, contracts/api.md).

export class BookmarkRepository {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this.db = db;
  }

  // --- Tags -----------------------------------------------------------------

  /**
   * Resolve a list of tag names to tag ids, creating tags that don't exist.
   * Names are trimmed; empty/whitespace-only names are ignored.
   * @param {string[]} names
   * @returns {number[]}
   */
  _resolveTagIds(names) {
    const clean = [...new Set(
      (names || [])
        .map((n) => (typeof n === 'string' ? n.trim() : ''))
        .filter((n) => n.length > 0)
    )];
    const insert = this.db.prepare(
      'INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING'
    );
    const select = this.db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
    return clean.map((name) => {
      insert.run(name);
      return select.get(name).id;
    });
  }

  _setBookmarkTags(bookmarkId, names) {
    this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    const link = this.db.prepare(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    );
    for (const tagId of this._resolveTagIds(names)) {
      link.run(bookmarkId, tagId);
    }
  }

  _tagsFor(bookmarkId) {
    return this.db
      .prepare(`
        SELECT t.name FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        WHERE bt.bookmark_id = ?
        ORDER BY t.name COLLATE NOCASE
      `)
      .all(bookmarkId)
      .map((r) => r.name);
  }

  /** All tag names currently linked to at least one bookmark. */
  listTags() {
    return this.db
      .prepare(`
        SELECT DISTINCT t.name FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        ORDER BY t.name COLLATE NOCASE
      `)
      .all()
      .map((r) => r.name);
  }

  // --- Bookmarks ------------------------------------------------------------

  _hydrate(row) {
    if (!row) return null;
    return {
      id: row.id,
      url: row.url,
      title: row.title ?? '',
      notes: row.notes ?? '',
      tags: this._tagsFor(row.id),
      created_at: row.created_at,
    };
  }

  /**
   * Create a bookmark. `url` must already be normalized/validated by the caller.
   * @returns {{ bookmark: object, duplicate: boolean }}
   */
  createBookmark({ url, title = '', notes = '', tags = [] }) {
    const duplicate =
      this.db.prepare('SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1').get(url) != null;

    const createTx = this.db.transaction(() => {
      const info = this.db
        .prepare(
          'INSERT INTO bookmarks (url, title, notes, created_at) VALUES (?, ?, ?, ?)'
        )
        .run(url, title ?? '', notes ?? '', new Date().toISOString());
      const id = info.lastInsertRowid;
      this._setBookmarkTags(id, tags);
      return id;
    });
    const id = createTx();
    return { bookmark: this.getBookmark(id), duplicate };
  }

  getBookmark(id) {
    return this._hydrate(this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
  }

  /**
   * List bookmarks newest-first, optionally filtered by keyword `q`
   * (case-insensitive substring across title/url/notes) and/or `tag` name.
   */
  listBookmarks({ q = '', tag = '' } = {}) {
    const clauses = [];
    const params = {};

    if (q && q.trim() !== '') {
      clauses.push('(b.title LIKE :kw OR b.url LIKE :kw OR b.notes LIKE :kw)');
      params.kw = `%${q.trim()}%`;
    }
    if (tag && tag.trim() !== '') {
      clauses.push(`b.id IN (
        SELECT bt.bookmark_id FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.name = :tag COLLATE NOCASE
      )`);
      params.tag = tag.trim();
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`)
      .all(params);
    return rows.map((r) => this._hydrate(r));
  }

  /**
   * Update editable fields of a bookmark. Only provided fields change; when
   * `tags` is provided it replaces the whole tag set. `url` must be pre-validated.
   * @returns {object|null} the updated bookmark, or null if not found
   */
  updateBookmark(id, fields) {
    const existing = this.getBookmark(id);
    if (!existing) return null;

    const updateTx = this.db.transaction(() => {
      const sets = [];
      const params = { id };
      for (const key of ['url', 'title', 'notes']) {
        if (Object.prototype.hasOwnProperty.call(fields, key)) {
          sets.push(`${key} = :${key}`);
          params[key] = fields[key] ?? '';
        }
      }
      if (sets.length) {
        this.db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = :id`).run(params);
      }
      if (Object.prototype.hasOwnProperty.call(fields, 'tags')) {
        this._setBookmarkTags(id, fields.tags);
      }
    });
    updateTx();
    return this.getBookmark(id);
  }

  /** @returns {boolean} true if a bookmark was deleted */
  deleteBookmark(id) {
    const info = this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    return info.changes > 0;
  }
}
