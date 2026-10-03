import { DatabaseSync } from 'node:sqlite';

const SORT_SQL = {
  newest: 'b.created_at DESC, b.id DESC',
  oldest: 'b.created_at ASC, b.id ASC',
  az: 'b.title COLLATE NOCASE ASC, b.id ASC',
  za: 'b.title COLLATE NOCASE DESC, b.id DESC',
};

function normalizeTag(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isoNow() {
  return new Date().toISOString();
}

export function createStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      canonical_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL CHECK(length(trim(title)) > 0),
      description TEXT NOT NULL DEFAULT '',
      source_host TEXT NOT NULL DEFAULT '',
      site_name TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      preview_image TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL DEFAULT '',
      capture_status TEXT NOT NULL CHECK(capture_status IN ('captured', 'none')),
      captured_at TEXT,
      read_later INTEGER NOT NULL DEFAULT 0 CHECK(read_later IN (0,1)),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS saved_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0),
      query TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      sort TEXT NOT NULL DEFAULT 'newest',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_section ON bookmarks(archived, read_later);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id, bookmark_id);
  `);

  const getTagsForIds = (ids) => {
    if (!ids.length) return new Map();
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT bt.bookmark_id, t.name
      FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
      WHERE bt.bookmark_id IN (${placeholders})
      ORDER BY t.name COLLATE NOCASE
    `).all(...ids);
    const result = new Map(ids.map((id) => [id, []]));
    for (const row of rows) result.get(row.bookmark_id)?.push(row.name);
    return result;
  };

  const hydrate = (rows) => {
    const tags = getTagsForIds(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      read_later: Boolean(row.read_later),
      archived: Boolean(row.archived),
      tags: tags.get(row.id) ?? [],
    }));
  };

  const getBookmark = (id) => {
    const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    return row ? hydrate([row])[0] : null;
  };

  const transaction = (work) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  return {
    db,
    close() { db.close(); },

    findByCanonical(canonicalUrl) {
      const row = db.prepare('SELECT * FROM bookmarks WHERE canonical_url = ?').get(canonicalUrl);
      return row ? hydrate([row])[0] : null;
    },

    getBookmark,

    insertBookmark(bookmark) {
      const now = bookmark.created_at ?? isoNow();
      const result = db.prepare(`
        INSERT INTO bookmarks (
          url, canonical_url, title, description, source_host, site_name, author,
          published_at, preview_image, content_html, capture_status, captured_at,
          read_later, archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
      `).run(
        bookmark.url, bookmark.canonical_url, bookmark.title.trim(), bookmark.description ?? '',
        bookmark.source_host ?? '', bookmark.site_name ?? '', bookmark.author ?? '',
        bookmark.published_at ?? null, bookmark.preview_image ?? '', bookmark.content_html ?? '',
        bookmark.capture_status, bookmark.captured_at ?? null, now, now,
      );
      return getBookmark(Number(result.lastInsertRowid));
    },

    listBookmarks({ section = 'all', query = '', tag = '', sort = 'newest', page = 1, perPage = 8 } = {}) {
      const where = [];
      const values = [];
      if (section === 'archive') where.push('b.archived = 1');
      else if (section === 'later') where.push('b.archived = 0 AND b.read_later = 1');
      else where.push('b.archived = 0');
      if (query.trim()) {
        where.push("instr(lower(b.title || ' ' || b.description || ' ' || b.source_host || ' ' || b.site_name), lower(?)) > 0");
        values.push(query.trim());
      }
      if (tag.trim()) {
        where.push('EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)');
        values.push(normalizeTag(tag));
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = Number(db.prepare(`SELECT count(*) AS count FROM bookmarks b ${whereSql}`).get(...values).count);
      const safePage = Math.max(1, Number(page) || 1);
      const safePerPage = Math.max(1, Math.min(100, Number(perPage) || 8));
      const totalPages = Math.max(1, Math.ceil(total / safePerPage));
      const actualPage = Math.min(safePage, totalPages);
      const rows = db.prepare(`
        SELECT b.* FROM bookmarks b ${whereSql}
        ORDER BY ${SORT_SQL[sort] ?? SORT_SQL.newest}
        LIMIT ? OFFSET ?
      `).all(...values, safePerPage, (actualPage - 1) * safePerPage);
      const items = hydrate(rows).map(({ content_html, ...bookmark }) => bookmark);
      return { items, total, page: actualPage, perPage: safePerPage, totalPages };
    },

    getNavigation() {
      const counts = db.prepare(`
        SELECT
          sum(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS all_count,
          sum(CASE WHEN archived = 0 AND read_later = 1 THEN 1 ELSE 0 END) AS later_count,
          sum(CASE WHEN archived = 1 THEN 1 ELSE 0 END) AS archive_count
        FROM bookmarks
      `).get();
      const tags = db.prepare(`
        SELECT t.name, count(*) AS count
        FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        JOIN bookmarks b ON b.id = bt.bookmark_id
        WHERE b.archived = 0
        GROUP BY t.id, t.name
        ORDER BY t.name COLLATE NOCASE
      `).all();
      const savedViews = db.prepare('SELECT * FROM saved_views ORDER BY created_at ASC, id ASC').all();
      return {
        counts: {
          all: Number(counts.all_count ?? 0),
          later: Number(counts.later_count ?? 0),
          archive: Number(counts.archive_count ?? 0),
        },
        tags: tags.map((row) => ({ ...row, count: Number(row.count) })),
        savedViews,
      };
    },

    updateDetails(id, { title, description }) {
      if (!String(title ?? '').trim()) {
        const error = new Error('Add a title so you can recognize this bookmark.');
        error.code = 'title_required'; error.status = 400; throw error;
      }
      const result = db.prepare('UPDATE bookmarks SET title = ?, description = ?, updated_at = ? WHERE id = ?')
        .run(String(title).trim(), String(description ?? '').trim(), isoNow(), id);
      return result.changes ? getBookmark(id) : null;
    },

    setTags(id, tagNames) {
      if (!getBookmark(id)) return null;
      const names = [...new Set((tagNames ?? []).map(normalizeTag).filter(Boolean))];
      transaction(() => {
        db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(id);
        for (const name of names) {
          db.prepare('INSERT INTO tags(name) VALUES (?) ON CONFLICT(name) DO NOTHING').run(name);
          const tag = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name);
          db.prepare('INSERT INTO bookmark_tags(bookmark_id, tag_id) VALUES (?, ?)').run(id, tag.id);
        }
        db.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id = tags.id)');
        db.prepare('UPDATE bookmarks SET updated_at = ? WHERE id = ?').run(isoNow(), id);
      });
      return getBookmark(id);
    },

    suggestTags(query, exclude = []) {
      const exclusions = new Set(exclude.map(normalizeTag));
      return this.getNavigation().tags
        .filter((tag) => tag.name.includes(normalizeTag(query)) && !exclusions.has(tag.name))
        .slice(0, 8);
    },

    setReadLater(id, value) {
      const current = getBookmark(id);
      if (!current) return null;
      if (current.archived && value) {
        const error = new Error('Restore the bookmark before adding it to Read later.');
        error.code = 'archived_bookmark'; error.status = 409; throw error;
      }
      db.prepare('UPDATE bookmarks SET read_later = ?, updated_at = ? WHERE id = ?').run(value ? 1 : 0, isoNow(), id);
      return getBookmark(id);
    },

    archive(id) {
      const result = db.prepare('UPDATE bookmarks SET archived = 1, read_later = 0, updated_at = ? WHERE id = ?').run(isoNow(), id);
      return result.changes ? getBookmark(id) : null;
    },

    restore(id) {
      const result = db.prepare('UPDATE bookmarks SET archived = 0, read_later = 0, updated_at = ? WHERE id = ?').run(isoNow(), id);
      return result.changes ? getBookmark(id) : null;
    },

    deleteBookmark(id) {
      return transaction(() => {
        const existing = getBookmark(id);
        if (!existing) return null;
        db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
        db.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id = tags.id)');
        return existing;
      });
    },

    createSavedView({ name, query = '', tag = '', sort = 'newest' }) {
      if (!String(name ?? '').trim()) {
        const error = new Error('Give this saved view a name.');
        error.code = 'name_required'; error.status = 400; throw error;
      }
      const result = db.prepare('INSERT INTO saved_views(name, query, tag, sort, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(String(name).trim(), String(query), normalizeTag(tag), SORT_SQL[sort] ? sort : 'newest', isoNow());
      return db.prepare('SELECT * FROM saved_views WHERE id = ?').get(Number(result.lastInsertRowid));
    },

    clearAll() {
      transaction(() => {
        db.exec('DELETE FROM bookmark_tags; DELETE FROM tags; DELETE FROM bookmarks; DELETE FROM saved_views;');
      });
    },
  };
}
