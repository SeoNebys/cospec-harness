// Bookmark + tag data access: CRUD, search, filter, tag listing.
// (data-model.md, contracts/api.md)

import { normalizeUrl, labelFromUrl } from './url.js';

/**
 * Create the data-access layer bound to an open database.
 * @param {import('better-sqlite3').Database} db
 */
export function createStore(db) {
  // --- tag helpers -----------------------------------------------------------

  function upsertTag(name) {
    const trimmed = String(name).trim();
    if (trimmed === '') return null;
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed);
    return db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(trimmed).id;
  }

  function setTags(bookmarkId, tags) {
    db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    if (!Array.isArray(tags)) return;
    const seen = new Set();
    const link = db.prepare(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    );
    for (const raw of tags) {
      const name = String(raw).trim();
      if (name === '' || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const tagId = upsertTag(name);
      if (tagId) link.run(bookmarkId, tagId);
    }
  }

  function tagsFor(bookmarkId) {
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

  // --- serialization ---------------------------------------------------------

  function toApi(row) {
    const title = row.title || '';
    return {
      id: row.id,
      url: row.url,
      title,
      displayLabel: title.trim() !== '' ? title : labelFromUrl(row.url), // FR-004
      notes: row.notes || '',
      tags: tagsFor(row.id),
      dateAdded: row.date_added,
      dateUpdated: row.date_updated,
    };
  }

  function getRow(id) {
    return db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  }

  // --- public operations -----------------------------------------------------

  /**
   * Create a bookmark. Returns { bookmark, warning? }.
   * `warning: 'duplicate_url'` is set when an identical normalized URL already
   * exists, but creation still proceeds (FR-013).
   */
  function createBookmark({ url, title = '', notes = '', tags = [] }) {
    const normalized = normalizeUrl(url); // throws INVALID_URL (FR-002/FR-003)
    const duplicate = db
      .prepare('SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1')
      .get(normalized);

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO bookmarks (url, title, notes, date_added, date_updated)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(normalized, String(title).trim(), String(notes), now, now);

    setTags(info.lastInsertRowid, tags);
    const bookmark = toApi(getRow(info.lastInsertRowid));
    return duplicate ? { bookmark, warning: 'duplicate_url' } : { bookmark };
  }

  /**
   * List bookmarks, most recently added first (FR-005, FR-014).
   * Optional case-insensitive keyword search across title/url/notes/tags
   * (FR-011) and tag-name filter (FR-010).
   * @param {{ q?: string, tag?: string }} [opts]
   */
  function listBookmarks({ q, tag } = {}) {
    const clauses = [];
    const params = [];

    if (q && q.trim() !== '') {
      const like = `%${q.trim()}%`;
      clauses.push(`(
        b.title LIKE ? COLLATE NOCASE
        OR b.url LIKE ? COLLATE NOCASE
        OR b.notes LIKE ? COLLATE NOCASE
        OR EXISTS (
          SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
          WHERE bt.bookmark_id = b.id AND t.name LIKE ? COLLATE NOCASE
        )
      )`);
      params.push(like, like, like, like);
    }

    if (tag && tag.trim() !== '') {
      clauses.push(`EXISTS (
        SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
        WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE
      )`);
      params.push(tag.trim());
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT b.* FROM bookmarks b ${where} ORDER BY b.date_added DESC, b.id DESC`)
      .all(...params);
    return rows.map(toApi);
  }

  /** Update title/url/notes/tags; refreshes date_updated (FR-007). */
  function updateBookmark(id, { url, title = '', notes = '', tags = [] }) {
    if (!getRow(id)) return null;
    const normalized = normalizeUrl(url);
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE bookmarks SET url = ?, title = ?, notes = ?, date_updated = ? WHERE id = ?`
    ).run(normalized, String(title).trim(), String(notes), now, id);
    setTags(id, tags);
    return toApi(getRow(id));
  }

  /** Delete a bookmark; tag links cascade (FR-008). Returns true if removed. */
  function deleteBookmark(id) {
    const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    return info.changes > 0;
  }

  /** Distinct tag names currently in use (FR-010 filter UI). */
  function listTags() {
    return db
      .prepare(
        `SELECT DISTINCT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         ORDER BY t.name COLLATE NOCASE`
      )
      .all()
      .map((r) => r.name);
  }

  return { createBookmark, listBookmarks, updateBookmark, deleteBookmark, listTags };
}
