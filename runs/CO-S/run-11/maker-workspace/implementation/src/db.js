'use strict';

// Data access layer (SQLite via better-sqlite3). Central store so the same
// account's collection is reachable from any device (SCN-013).

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function openDb(file) {
  const dbFile = file || process.env.DB_FILE || path.join(__dirname, '..', 'data', 'bookmarks.db');
  if (dbFile !== ':memory:') {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  }
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id          INTEGER PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      norm_url    TEXT NOT NULL,
      title       TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      note        TEXT NOT NULL DEFAULT '',
      finished    INTEGER NOT NULL DEFAULT 0,
      archived    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, norm_url)
    );
    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag         TEXT NOT NULL,
      PRIMARY KEY (bookmark_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON bookmark_tags(tag);
  `);
}

function createDataStore(db) {
  const S = {
    insertUser: db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
    sessionUser: db.prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    listBm: db.prepare('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY id DESC'),
    bmById: db.prepare('SELECT * FROM bookmarks WHERE id = ? AND user_id = ?'),
    bmByNorm: db.prepare('SELECT * FROM bookmarks WHERE user_id = ? AND norm_url = ?'),
    insertBm: db.prepare(
      `INSERT INTO bookmarks (user_id, url, norm_url, title, description, note, finished, archived)
       VALUES (@user_id, @url, @norm_url, @title, @description, @note, @finished, @archived)`
    ),
    updateBm: db.prepare(
      `UPDATE bookmarks SET url=@url, norm_url=@norm_url, title=@title, description=@description,
         note=@note, updated_at=datetime('now') WHERE id=@id AND user_id=@user_id`
    ),
    setFinished: db.prepare(
      `UPDATE bookmarks SET finished=@finished, updated_at=datetime('now') WHERE id=@id AND user_id=@user_id`
    ),
    setArchived: db.prepare(
      `UPDATE bookmarks SET archived=@archived, updated_at=datetime('now') WHERE id=@id AND user_id=@user_id`
    ),
    deleteBm: db.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?'),
    tagsFor: db.prepare('SELECT tag FROM bookmark_tags WHERE bookmark_id = ? ORDER BY tag'),
    insertTag: db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag) VALUES (?, ?)'),
    clearTags: db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?'),
    distinctTags: db.prepare(
      `SELECT DISTINCT t.tag FROM bookmark_tags t
       JOIN bookmarks b ON b.id = t.bookmark_id WHERE b.user_id = ? ORDER BY t.tag`
    ),
  };

  function cleanTags(tags) {
    if (!Array.isArray(tags)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const t = raw.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }

  function hydrate(row) {
    if (!row) return null;
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      note: row.note,
      finished: !!row.finished,
      archived: !!row.archived,
      tags: S.tagsFor.all(row.id).map((r) => r.tag),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function setTags(bookmarkId, tags) {
    S.clearTags.run(bookmarkId);
    for (const tag of cleanTags(tags)) S.insertTag.run(bookmarkId, tag);
  }

  return {
    db,
    // users
    createUser(email, passwordHash) {
      const info = S.insertUser.run(email.trim().toLowerCase(), passwordHash);
      return S.userById.get(info.lastInsertRowid);
    },
    getUserByEmail(email) {
      return S.userByEmail.get(String(email || '').trim().toLowerCase());
    },
    getUserById(id) {
      return S.userById.get(id);
    },
    // sessions
    createSession(token, userId) {
      S.insertSession.run(token, userId);
    },
    getSessionUser(token) {
      if (!token) return null;
      return S.sessionUser.get(token) || null;
    },
    destroySession(token) {
      S.deleteSession.run(token);
    },
    // bookmarks
    listBookmarks(userId) {
      return S.listBm.all(userId).map(hydrate);
    },
    getBookmark(userId, id) {
      return hydrate(S.bmById.get(id, userId));
    },
    findByNormUrl(userId, normUrl) {
      return hydrate(S.bmByNorm.get(userId, normUrl));
    },
    createBookmark(userId, data) {
      const create = db.transaction((d) => {
        const info = S.insertBm.run({
          user_id: userId,
          url: d.url,
          norm_url: d.normUrl,
          title: d.title || '',
          description: d.description || '',
          note: d.note || '',
          finished: d.finished ? 1 : 0,
          archived: d.archived ? 1 : 0,
        });
        setTags(info.lastInsertRowid, d.tags);
        return info.lastInsertRowid;
      });
      const id = create(data);
      return hydrate(S.bmById.get(id, userId));
    },
    updateBookmark(userId, id, data) {
      const run = db.transaction((d) => {
        const info = S.updateBm.run({
          id,
          user_id: userId,
          url: d.url,
          norm_url: d.normUrl,
          title: d.title || '',
          description: d.description || '',
          note: d.note || '',
        });
        if (info.changes === 0) return null;
        setTags(id, d.tags);
        return id;
      });
      const ok = run(data);
      return ok ? hydrate(S.bmById.get(id, userId)) : null;
    },
    setFinished(userId, id, finished) {
      const info = S.setFinished.run({ id, user_id: userId, finished: finished ? 1 : 0 });
      return info.changes > 0 ? hydrate(S.bmById.get(id, userId)) : null;
    },
    setArchived(userId, id, archived) {
      const info = S.setArchived.run({ id, user_id: userId, archived: archived ? 1 : 0 });
      return info.changes > 0 ? hydrate(S.bmById.get(id, userId)) : null;
    },
    deleteBookmark(userId, id) {
      return S.deleteBm.run(id, userId).changes > 0;
    },
    listTags(userId) {
      return S.distinctTags.all(userId).map((r) => r.tag);
    },
    cleanTags,
  };
}

module.exports = { openDb, createDataStore, migrate };
