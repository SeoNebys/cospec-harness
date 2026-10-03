// Data access for bookmarks and tags (data-model.md; FR-003/007/008/009/010-014).
import { normalizeUrl } from './lib/url.js';
import { fetchTitle } from './lib/title.js';

export class DuplicateUrlError extends Error {
  constructor(message = 'This URL is already bookmarked.') {
    super(message);
    this.code = 'duplicate_url';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Bookmark not found.') {
    super(message);
    this.code = 'not_found';
  }
}

const MAX_TAG_LENGTH = 50;

export function createRepository(db, { titleFetcher = fetchTitle } = {}) {
  // --- tag helpers -----------------------------------------------------------
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags(name) VALUES (?)');
  const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const linkTag = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id) VALUES (?, ?)'
  );
  const unlinkAll = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?');
  const pruneOrphans = db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)'
  );

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    const seen = new Set();
    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const name = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
      if (name) seen.add(name);
    }
    return [...seen];
  }

  function setTags(bookmarkId, tags) {
    unlinkAll.run(bookmarkId);
    for (const name of normalizeTags(tags)) {
      insertTag.run(name);
      const { id } = findTag.get(name);
      linkTag.run(bookmarkId, id);
    }
    pruneOrphans.run();
  }

  function tagsFor(bookmarkId) {
    return db
      .prepare(
        `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ? ORDER BY t.name`
      )
      .all(bookmarkId)
      .map((r) => r.name);
  }

  function toBookmark(row) {
    if (!row) return null;
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      tags: tagsFor(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // --- queries ---------------------------------------------------------------
  const byId = db.prepare('SELECT * FROM bookmarks WHERE id = ?');
  const byUrl = db.prepare('SELECT * FROM bookmarks WHERE url = ?');

  async function resolveTitle(url, customTitle) {
    if (typeof customTitle === 'string' && customTitle.trim() !== '') {
      return customTitle.trim();
    }
    const fetched = await titleFetcher(url);
    return fetched && fetched.trim() !== '' ? fetched.trim() : url;
  }

  return {
    /** List bookmarks, newest first, with optional keyword + tag filters. */
    list({ q = '', tags = [] } = {}) {
      const conditions = [];
      const params = [];

      const keyword = typeof q === 'string' ? q.trim() : '';
      if (keyword) {
        const like = `%${keyword.toLowerCase()}%`;
        conditions.push(`(
          LOWER(b.url) LIKE ? OR LOWER(b.title) LIKE ? OR b.id IN (
            SELECT bt.bookmark_id FROM bookmark_tags bt
            JOIN tags t ON t.id = bt.tag_id WHERE LOWER(t.name) LIKE ?
          )
        )`);
        params.push(like, like, like);
      }

      const tagList = normalizeTags(tags);
      for (const name of tagList) {
        conditions.push(`b.id IN (
          SELECT bt.bookmark_id FROM bookmark_tags bt
          JOIN tags t ON t.id = bt.tag_id WHERE t.name = ?
        )`);
        params.push(name);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = db
        .prepare(`SELECT b.* FROM bookmarks b ${where} ORDER BY b.created_at DESC, b.id DESC`)
        .all(...params);
      return rows.map(toBookmark);
    },

    getById(id) {
      return toBookmark(byId.get(id));
    },

    async create({ url, title, tags } = {}) {
      const normalized = normalizeUrl(url); // throws InvalidUrlError
      if (byUrl.get(normalized)) throw new DuplicateUrlError();

      const finalTitle = await resolveTitle(normalized, title);
      const now = new Date().toISOString();

      const tx = db.transaction(() => {
        const info = db
          .prepare(
            'INSERT INTO bookmarks(url, title, created_at, updated_at) VALUES (?,?,?,?)'
          )
          .run(normalized, finalTitle, now, now);
        setTags(info.lastInsertRowid, tags);
        return info.lastInsertRowid;
      });
      return this.getById(tx());
    },

    async update(id, { url, title, tags } = {}) {
      const existing = byId.get(id);
      if (!existing) throw new NotFoundError();

      let normalized = existing.url;
      if (url !== undefined) {
        normalized = normalizeUrl(url); // throws InvalidUrlError
        const clash = byUrl.get(normalized);
        if (clash && clash.id !== id) throw new DuplicateUrlError();
      }

      // Title: explicit non-empty wins; blank/omitted keeps existing unless url changed.
      let finalTitle = existing.title;
      if (typeof title === 'string' && title.trim() !== '') {
        finalTitle = title.trim();
      } else if (url !== undefined && normalized !== existing.url && (title === '' || title === undefined)) {
        finalTitle = await resolveTitle(normalized, undefined);
      }

      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        db.prepare(
          'UPDATE bookmarks SET url = ?, title = ?, updated_at = ? WHERE id = ?'
        ).run(normalized, finalTitle, now, id);
        if (tags !== undefined) setTags(id, tags);
      });
      tx();
      return this.getById(id);
    },

    remove(id) {
      const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
      if (info.changes === 0) throw new NotFoundError();
      pruneOrphans.run();
      return true;
    },

    listTags() {
      return db
        .prepare(
          `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
           FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
           GROUP BY t.id ORDER BY t.name`
        )
        .all();
    },
  };
}
