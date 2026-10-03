import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, hashToken, verifyPassword } from './security.js';

function now() {
  return Date.now();
}

function rowToBookmark(row, tags = []) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    canonicalUrl: row.canonical_url,
    title: row.title,
    description: row.description,
    siteName: row.site_name,
    siteIcon: row.site_icon,
    previewImage: row.preview_image,
    metadataStatus: row.metadata_status,
    noteHtml: row.note_html,
    notePlain: row.note_plain,
    readLater: Boolean(row.read_later),
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags
  };
}

export class StowDatabase {
  constructor(filePath, options = {}) {
    if (filePath !== ':memory:') fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.migrate();
    this.seedUser(options.email ?? 'you@example.com', options.password ?? 'bookmarks');
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        canonical_url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        site_name TEXT NOT NULL,
        site_icon TEXT NOT NULL DEFAULT '',
        preview_image TEXT NOT NULL DEFAULT '',
        metadata_status TEXT NOT NULL CHECK(metadata_status IN ('available', 'unavailable')),
        note_html TEXT NOT NULL DEFAULT '',
        note_plain TEXT NOT NULL DEFAULT '',
        read_later INTEGER NOT NULL DEFAULT 0 CHECK(read_later IN (0, 1)),
        archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bookmarks_created_at ON bookmarks(created_at DESC);
      CREATE INDEX IF NOT EXISTS bookmarks_read_later ON bookmarks(read_later, archived);
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS bookmark_tags (
        bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (bookmark_id, tag_id)
      );
    `);
  }

  seedUser(email, password) {
    const existing = this.db.prepare('SELECT id FROM users LIMIT 1').get();
    if (existing) return;
    const credentials = hashPassword(password);
    this.db.prepare('INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)')
      .run(email.trim().toLowerCase(), credentials.hash, credentials.salt);
  }

  authenticate(email, password) {
    const user = this.db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(String(email).trim());
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) return null;
    return { id: user.id, email: user.email };
  }

  createSession(userId, token, ttlMs) {
    const createdAt = now();
    const expiresAt = createdAt + ttlMs;
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(createdAt);
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), userId, createdAt, expiresAt);
    return expiresAt;
  }

  getSession(token) {
    if (!token) return null;
    const row = this.db.prepare(`
      SELECT sessions.expires_at, users.id, users.email
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(hashToken(token), now());
    return row ? { user: { id: row.id, email: row.email }, expiresAt: row.expires_at } : null;
  }

  deleteSession(token) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  getBookmarkByCanonical(canonicalUrl) {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE canonical_url = ?').get(canonicalUrl);
    return this.hydrateBookmark(row);
  }

  getBookmark(id) {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    return this.hydrateBookmark(row);
  }

  hydrateBookmark(row) {
    if (!row) return null;
    const tags = this.db.prepare(`
      SELECT tags.id, tags.name
      FROM tags JOIN bookmark_tags ON bookmark_tags.tag_id = tags.id
      WHERE bookmark_tags.bookmark_id = ? ORDER BY tags.name COLLATE NOCASE
    `).all(row.id);
    return rowToBookmark(row, tags);
  }

  createBookmark(data) {
    const timestamp = now();
    const result = this.db.prepare(`
      INSERT INTO bookmarks (
        url, canonical_url, title, description, site_name, site_icon,
        preview_image, metadata_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.url,
      data.canonicalUrl,
      data.title,
      data.description ?? '',
      data.siteName,
      data.siteIcon ?? '',
      data.previewImage ?? '',
      data.metadataStatus,
      timestamp,
      timestamp
    );
    return this.getBookmark(Number(result.lastInsertRowid));
  }

  updateBookmark(id, fields) {
    const columns = {
      url: 'url',
      canonicalUrl: 'canonical_url',
      title: 'title',
      description: 'description',
      siteName: 'site_name',
      siteIcon: 'site_icon',
      previewImage: 'preview_image',
      metadataStatus: 'metadata_status',
      noteHtml: 'note_html',
      notePlain: 'note_plain',
      readLater: 'read_later',
      archived: 'archived'
    };
    const entries = Object.entries(fields).filter(([key]) => columns[key]);
    if (!entries.length) return this.getBookmark(id);
    const setters = entries.map(([key]) => `${columns[key]} = ?`);
    const values = entries.map(([key, value]) => (
      ['readLater', 'archived'].includes(key) ? Number(Boolean(value)) : value
    ));
    setters.push('updated_at = ?');
    values.push(now(), id);
    const result = this.db.prepare(`UPDATE bookmarks SET ${setters.join(', ')} WHERE id = ?`).run(...values);
    return result.changes ? this.getBookmark(id) : null;
  }

  deleteBookmark(id) {
    return this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
  }

  listBookmarks(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 12, 1), 50);
    const offset = Math.max(Number(options.offset) || 0, 0);
    const where = [];
    const params = [];
    if (options.view === 'aside') where.push('bookmarks.archived = 1');
    else {
      where.push('bookmarks.archived = 0');
      if (options.view === 'later') where.push('bookmarks.read_later = 1');
    }

    const words = String(options.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const word of words) {
      where.push(`LOWER(bookmarks.title || ' ' || bookmarks.description || ' ' || bookmarks.url || ' ' || bookmarks.note_plain) LIKE ?`);
      params.push(`%${word}%`);
    }
    if (options.tag) {
      where.push(`EXISTS (
        SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
        WHERE bt.bookmark_id = bookmarks.id AND t.name_key = ?
      )`);
      params.push(String(options.tag).trim().toLowerCase());
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = this.db.prepare(`SELECT COUNT(*) AS count FROM bookmarks ${clause}`).get(...params).count;
    const rows = this.db.prepare(`
      SELECT * FROM bookmarks ${clause}
      ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    const counts = this.db.prepare(`
      SELECT
        SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN archived = 0 AND read_later = 1 THEN 1 ELSE 0 END) AS later,
        SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) AS aside
      FROM bookmarks
    `).get();
    return {
      items: rows.map((row) => this.hydrateBookmark(row)),
      total,
      limit,
      offset,
      counts: {
        active: Number(counts.active ?? 0),
        later: Number(counts.later ?? 0),
        aside: Number(counts.aside ?? 0)
      }
    };
  }

  addTag(bookmarkId, rawName) {
    const name = String(rawName).trim().replace(/\s+/g, ' ').slice(0, 50);
    if (!name) {
      const error = new Error('Enter a tag name.');
      error.code = 'INVALID_TAG';
      throw error;
    }
    const key = name.toLowerCase();
    let tag = this.db.prepare('SELECT * FROM tags WHERE name_key = ?').get(key);
    if (!tag) {
      const result = this.db.prepare('INSERT INTO tags (name, name_key) VALUES (?, ?)').run(name, key);
      tag = { id: Number(result.lastInsertRowid), name, name_key: key };
    }
    this.db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)').run(bookmarkId, tag.id);
    return this.getBookmark(bookmarkId);
  }

  removeTag(bookmarkId, tagId) {
    const result = this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?').run(bookmarkId, tagId);
    return result.changes > 0 ? this.getBookmark(bookmarkId) : null;
  }

  listTags(query = '') {
    const key = String(query).trim().toLowerCase();
    return this.db.prepare(`
      SELECT tags.id, tags.name, COUNT(bookmark_tags.bookmark_id) AS usage_count
      FROM tags LEFT JOIN bookmark_tags ON bookmark_tags.tag_id = tags.id
      WHERE tags.name_key LIKE ?
      GROUP BY tags.id
      HAVING usage_count > 0
      ORDER BY tags.name COLLATE NOCASE LIMIT 50
    `).all(`${key}%`).map((row) => ({ id: row.id, name: row.name, usageCount: row.usage_count }));
  }

  close() {
    this.db.close();
  }
}
