import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeUrl, parseWebUrl } from './url.js';

function boolean(value) {
  return value ? 1 : 0;
}

function likePattern(value) {
  return `%${value.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

export class BookmarkStore {
  constructor(filename) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        normalized_url TEXT NOT NULL UNIQUE,
        site_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        favicon_url TEXT,
        is_read_later INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE
      );
      CREATE TABLE IF NOT EXISTS bookmark_labels (
        bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
        label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (bookmark_id, label_id)
      );
      CREATE INDEX IF NOT EXISTS idx_bookmarks_archive_later ON bookmarks(is_archived, is_read_later);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_updated ON bookmarks(updated_at DESC);
    `);
  }

  close() {
    this.db.close();
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  labelForName(name) {
    const cleaned = String(name || '').trim();
    if (!cleaned) return null;
    const existing = this.db.prepare('SELECT id, name FROM labels WHERE name = ? COLLATE NOCASE').get(cleaned);
    if (existing) return existing;
    const result = this.db.prepare('INSERT INTO labels(name) VALUES (?)').run(cleaned);
    return { id: Number(result.lastInsertRowid), name: cleaned };
  }

  setLabels(bookmarkId, names) {
    const unique = [];
    for (const value of names || []) {
      const cleaned = String(value || '').trim();
      if (cleaned && !unique.some(name => name.toLowerCase() === cleaned.toLowerCase())) unique.push(cleaned);
    }
    this.db.prepare('DELETE FROM bookmark_labels WHERE bookmark_id = ?').run(bookmarkId);
    const attach = this.db.prepare('INSERT OR IGNORE INTO bookmark_labels(bookmark_id, label_id) VALUES (?, ?)');
    for (const name of unique) {
      const label = this.labelForName(name);
      if (label) attach.run(bookmarkId, label.id);
    }
  }

  addLabel(bookmarkId, name) {
    const label = this.labelForName(name);
    if (label) this.db.prepare('INSERT OR IGNORE INTO bookmark_labels(bookmark_id, label_id) VALUES (?, ?)').run(bookmarkId, label.id);
    return label;
  }

  hydrate(rows) {
    if (!rows.length) return [];
    const ids = rows.map(row => row.id);
    const placeholders = ids.map(() => '?').join(',');
    const labelRows = this.db.prepare(`
      SELECT bl.bookmark_id, l.name
      FROM bookmark_labels bl JOIN labels l ON l.id = bl.label_id
      WHERE bl.bookmark_id IN (${placeholders})
      ORDER BY l.name COLLATE NOCASE
    `).all(...ids);
    const labels = new Map(ids.map(id => [id, []]));
    for (const row of labelRows) labels.get(row.bookmark_id).push(row.name);
    return rows.map(row => ({
      id: row.id,
      url: row.url,
      siteName: row.site_name,
      title: row.title,
      description: row.description,
      faviconUrl: row.favicon_url,
      readLater: Boolean(row.is_read_later),
      archived: Boolean(row.is_archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      labels: labels.get(row.id) || []
    }));
  }

  get(id) {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    return row ? this.hydrate([row])[0] : null;
  }

  findByUrl(url) {
    const normalized = normalizeUrl(url);
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE normalized_url = ?').get(normalized);
    return row ? this.hydrate([row])[0] : null;
  }

  create(input) {
    parseWebUrl(input.url);
    const normalized = normalizeUrl(input.url);
    const now = new Date().toISOString();
    return this.transaction(() => {
      const result = this.db.prepare(`
        INSERT INTO bookmarks(url, normalized_url, site_name, title, description, favicon_url, is_read_later, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        input.url.trim(), normalized, input.siteName.trim(), input.title.trim(),
        String(input.description || '').trim(), input.faviconUrl || null,
        boolean(input.readLater), now, now
      );
      const id = Number(result.lastInsertRowid);
      this.setLabels(id, input.labels || []);
      return this.get(id);
    });
  }

  update(id, changes) {
    const current = this.get(id);
    if (!current) return null;
    const next = {
      title: changes.title === undefined ? current.title : String(changes.title).trim(),
      description: changes.description === undefined ? current.description : String(changes.description || '').trim(),
      readLater: changes.readLater === undefined ? current.readLater : Boolean(changes.readLater),
      archived: changes.archived === undefined ? current.archived : Boolean(changes.archived)
    };
    if (!next.title) throw new Error('A title is required.');
    return this.transaction(() => {
      this.db.prepare(`
        UPDATE bookmarks SET title = ?, description = ?, is_read_later = ?, is_archived = ?, updated_at = ? WHERE id = ?
      `).run(next.title, next.description, boolean(next.readLater), boolean(next.archived), new Date().toISOString(), id);
      if (changes.labels !== undefined) this.setLabels(id, changes.labels);
      return this.get(id);
    });
  }

  delete(id) {
    return this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
  }

  list({ view = 'active', search = '', label = '' } = {}) {
    const clauses = [];
    const values = [];
    if (view === 'archived') clauses.push('b.is_archived = 1');
    else {
      clauses.push('b.is_archived = 0');
      if (view === 'later') clauses.push('b.is_read_later = 1');
    }
    if (label) {
      clauses.push('EXISTS (SELECT 1 FROM bookmark_labels fbl JOIN labels fl ON fl.id = fbl.label_id WHERE fbl.bookmark_id = b.id AND fl.name = ? COLLATE NOCASE)');
      values.push(label);
    }
    const term = String(search || '').trim();
    if (term) {
      clauses.push(`(
        b.title LIKE ? ESCAPE '\\' COLLATE NOCASE OR b.description LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        b.site_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR b.url LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        EXISTS (SELECT 1 FROM bookmark_labels sbl JOIN labels sl ON sl.id = sbl.label_id WHERE sbl.bookmark_id = b.id AND sl.name LIKE ? ESCAPE '\\' COLLATE NOCASE)
      )`);
      const pattern = likePattern(term);
      values.push(pattern, pattern, pattern, pattern, pattern);
    }
    const rows = this.db.prepare(`SELECT b.* FROM bookmarks b WHERE ${clauses.join(' AND ')} ORDER BY b.created_at DESC, b.id DESC`).all(...values);
    return this.hydrate(rows);
  }

  allLabels() {
    return this.db.prepare(`
      SELECT l.name, COUNT(bl.bookmark_id) AS bookmark_count
      FROM labels l LEFT JOIN bookmark_labels bl ON bl.label_id = l.id
      GROUP BY l.id HAVING bookmark_count > 0
      ORDER BY l.name COLLATE NOCASE
    `).all().map(row => ({ name: row.name, count: row.bookmark_count }));
  }

  totalActive() {
    return this.db.prepare('SELECT COUNT(*) AS count FROM bookmarks WHERE is_archived = 0').get().count;
  }

  totalAll() {
    return this.db.prepare('SELECT COUNT(*) AS count FROM bookmarks').get().count;
  }

  bulkAddLabel(ids, name) {
    return this.transaction(() => {
      const existing = ids.map(id => this.get(id)).filter(Boolean);
      for (const item of existing) this.addLabel(item.id, name);
      return existing.map(item => this.get(item.id));
    });
  }

  bulkReadLater(ids) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`UPDATE bookmarks SET is_read_later = 1, updated_at = ? WHERE id IN (${placeholders})`).run(new Date().toISOString(), ...ids);
    return ids.map(id => this.get(id)).filter(Boolean);
  }

  bulkDelete(ids) {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(',');
    return this.db.prepare(`DELETE FROM bookmarks WHERE id IN (${placeholders})`).run(...ids).changes;
  }
}
