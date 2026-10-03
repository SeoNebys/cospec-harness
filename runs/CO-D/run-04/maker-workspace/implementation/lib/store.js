import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalizeAddress, cleanDisplayAddress, tidyLabel, websiteName } from './urls.js';
import { compileSearch } from './search.js';

export class DuplicateBookmarkError extends Error {
  constructor(bookmark) {
    super('This page is already saved.');
    this.name = 'DuplicateBookmarkError';
    this.bookmark = bookmark;
  }
}

export class BookmarkStore {
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.#migrate();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        canonical_url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL CHECK(length(trim(title)) > 0),
        description TEXT NOT NULL DEFAULT '',
        favicon_url TEXT NOT NULL DEFAULT '',
        site_name TEXT NOT NULL,
        read_later INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        canonical_name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS bookmark_labels (
        bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
        label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (bookmark_id, label_id)
      );
    `);
  }

  close() {
    this.db.close();
  }

  reset() {
    this.db.exec('DELETE FROM bookmark_labels; DELETE FROM labels; DELETE FROM bookmarks;');
  }

  #labelsFor(id) {
    return this.db.prepare(`
      SELECT l.name
      FROM labels l
      JOIN bookmark_labels bl ON bl.label_id = l.id
      WHERE bl.bookmark_id = ?
      ORDER BY l.name COLLATE NOCASE
    `).all(id).map(row => row.name);
  }

  #toBookmark(row) {
    if (!row) return null;
    return {
      id: row.id,
      url: row.url,
      canonicalUrl: row.canonical_url,
      title: row.title,
      description: row.description,
      faviconUrl: row.favicon_url,
      siteName: row.site_name,
      readLater: Boolean(row.read_later),
      archived: Boolean(row.archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      labels: this.#labelsFor(row.id)
    };
  }

  get(id) {
    return this.#toBookmark(this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(Number(id)));
  }

  findByAddress(url) {
    const canonical = canonicalizeAddress(url);
    return this.#toBookmark(this.db.prepare('SELECT * FROM bookmarks WHERE canonical_url = ?').get(canonical));
  }

  #replaceLabels(bookmarkId, labelNames = []) {
    const unique = new Map();
    for (const input of labelNames) {
      const name = tidyLabel(input);
      if (name) unique.set(name.toLocaleLowerCase(), name);
    }

    this.db.prepare('DELETE FROM bookmark_labels WHERE bookmark_id = ?').run(bookmarkId);
    const findLabel = this.db.prepare('SELECT id, name FROM labels WHERE canonical_name = ?');
    const insertLabel = this.db.prepare('INSERT INTO labels (name, canonical_name) VALUES (?, ?)');
    const linkLabel = this.db.prepare('INSERT OR IGNORE INTO bookmark_labels (bookmark_id, label_id) VALUES (?, ?)');

    for (const [canonicalName, requestedName] of unique) {
      let label = findLabel.get(canonicalName);
      if (!label) {
        const result = insertLabel.run(requestedName, canonicalName);
        label = { id: Number(result.lastInsertRowid), name: requestedName };
      }
      linkLabel.run(bookmarkId, label.id);
    }
  }

  create(input) {
    const title = String(input.title ?? '').trim();
    if (!title) throw new Error('Add a title so you can recognize this bookmark later.');
    const url = cleanDisplayAddress(input.url);
    const canonicalUrl = canonicalizeAddress(url);
    const existing = this.#toBookmark(this.db.prepare('SELECT * FROM bookmarks WHERE canonical_url = ?').get(canonicalUrl));
    if (existing) throw new DuplicateBookmarkError(existing);

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = this.db.prepare(`
        INSERT INTO bookmarks (url, canonical_url, title, description, favicon_url, site_name, read_later, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        url,
        canonicalUrl,
        title,
        String(input.description ?? ''),
        String(input.faviconUrl ?? ''),
        input.siteName || websiteName(url),
        input.readLater ? 1 : 0,
        input.archived ? 1 : 0
      );
      const id = Number(result.lastInsertRowid);
      this.#replaceLabels(id, input.labels || []);
      this.db.exec('COMMIT;');
      return this.get(id);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  update(id, input) {
    const current = this.get(id);
    if (!current) return null;
    const title = input.title === undefined ? current.title : String(input.title).trim();
    if (!title) throw new Error('Add a title so you can recognize this bookmark later.');
    const url = input.url === undefined ? current.url : cleanDisplayAddress(input.url);
    const canonicalUrl = canonicalizeAddress(url);
    const duplicate = this.#toBookmark(this.db.prepare('SELECT * FROM bookmarks WHERE canonical_url = ? AND id <> ?').get(canonicalUrl, Number(id)));
    if (duplicate) throw new DuplicateBookmarkError(duplicate);

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare(`
        UPDATE bookmarks
        SET url = ?, canonical_url = ?, title = ?, description = ?, favicon_url = ?, site_name = ?,
            read_later = ?, archived = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        url,
        canonicalUrl,
        title,
        input.description === undefined ? current.description : String(input.description),
        input.faviconUrl === undefined ? current.faviconUrl : String(input.faviconUrl ?? ''),
        input.url === undefined && input.siteName === undefined
          ? current.siteName
          : (input.siteName || websiteName(url)),
        input.readLater === undefined ? Number(current.readLater) : Number(Boolean(input.readLater)),
        input.archived === undefined ? Number(current.archived) : Number(Boolean(input.archived)),
        Number(id)
      );
      if (input.labels !== undefined) this.#replaceLabels(Number(id), input.labels);
      this.db.exec('COMMIT;');
      return this.get(id);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  delete(id) {
    return this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(Number(id)).changes > 0;
  }

  list({ view = 'all', query = '', offset = 0, limit = 20 } = {}) {
    let where = 'archived = 0';
    if (view === 'read-later') where = 'archived = 0 AND read_later = 1';
    if (view === 'archive') where = 'archived = 1';
    const rows = this.db.prepare(`SELECT * FROM bookmarks WHERE ${where} ORDER BY created_at DESC, id DESC`).all();
    const matcher = compileSearch(query);
    const matches = rows.map(row => this.#toBookmark(row)).filter(matcher);
    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 20));
    return {
      items: matches.slice(safeOffset, safeOffset + safeLimit),
      total: matches.length,
      offset: safeOffset,
      limit: safeLimit
    };
  }

  overview() {
    const all = Number(this.db.prepare('SELECT count(*) AS count FROM bookmarks WHERE archived = 0').get().count);
    const readLater = Number(this.db.prepare('SELECT count(*) AS count FROM bookmarks WHERE archived = 0 AND read_later = 1').get().count);
    const archive = Number(this.db.prepare('SELECT count(*) AS count FROM bookmarks WHERE archived = 1').get().count);
    const labels = this.db.prepare(`
      SELECT l.name, count(*) AS count
      FROM labels l
      JOIN bookmark_labels bl ON bl.label_id = l.id
      JOIN bookmarks b ON b.id = bl.bookmark_id
      WHERE b.archived = 0
      GROUP BY l.id, l.name
      ORDER BY l.name COLLATE NOCASE
    `).all().map(row => ({ name: row.name, count: Number(row.count) }));
    return { all, readLater, archive, labels };
  }
}
