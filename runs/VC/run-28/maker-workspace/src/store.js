import db from './db.js';
import { normalizeUrl, ensureProtocol, extractDomain } from './url.js';
import { buildSearch, scopeClause, sortClause } from './search.js';

const now = () => new Date().toISOString();

// ---- Tags -----------------------------------------------------------------

const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
const getTagByName = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
const linkTag = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
const unlinkAllTags = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?');

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    if (typeof tags === 'string') tags = tags.split(',');
    else return [];
  }
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function setTags(bookmarkId, tags) {
  const names = normalizeTagList(tags);
  unlinkAllTags.run(bookmarkId);
  for (const name of names) {
    insertTag.run(name);
    const row = getTagByName.get(name);
    if (row) linkTag.run(bookmarkId, row.id);
  }
}

const tagsForBookmark = db.prepare(
  'SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id ' +
  'WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE'
);

export function listTags() {
  return db
    .prepare(
      'SELECT t.name AS name, COUNT(bt.bookmark_id) AS count ' +
      'FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id ' +
      'GROUP BY t.id HAVING count > 0 ORDER BY t.name COLLATE NOCASE'
    )
    .all();
}

// ---- Serialization --------------------------------------------------------

function hydrate(row) {
  if (!row) return null;
  const tags = tagsForBookmark.all(row.id).map((t) => t.name);
  const snapshotCount = db
    .prepare('SELECT COUNT(*) AS c FROM snapshots WHERE bookmark_id = ?')
    .get(row.id).c;
  return {
    ...row,
    read_later: !!row.read_later,
    archived: !!row.archived,
    tags,
    snapshot_count: snapshotCount,
  };
}

// ---- Bookmarks ------------------------------------------------------------

const findByKey = db.prepare('SELECT * FROM bookmarks WHERE url_key = ?');
const getById = db.prepare('SELECT * FROM bookmarks WHERE id = ?');

export function getBookmark(id) {
  return hydrate(getById.get(id));
}

export function findByUrl(url) {
  return hydrate(findByKey.get(normalizeUrl(url)));
}

// Create a bookmark, or return the existing one for a duplicate URL.
// Returns { bookmark, duplicate: boolean }.
export function createBookmark(data) {
  const url = ensureProtocol(data.url);
  const key = normalizeUrl(url);
  const existing = findByKey.get(key);
  if (existing) return { bookmark: hydrate(existing), duplicate: true };

  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO bookmarks
        (url, url_key, domain, title, description, favicon, preview_image, notes,
         read_later, archived, created_at, updated_at)
       VALUES (@url, @url_key, @domain, @title, @description, @favicon, @preview_image,
         @notes, @read_later, 0, @created_at, @updated_at)`
    )
    .run({
      url,
      url_key: key,
      domain: extractDomain(url),
      title: data.title || '',
      description: data.description || '',
      favicon: data.favicon || '',
      preview_image: data.preview_image || '',
      notes: data.notes || '',
      read_later: data.read_later ? 1 : 0,
      created_at: ts,
      updated_at: ts,
    });

  if (data.tags !== undefined) setTags(info.lastInsertRowid, data.tags);
  return { bookmark: hydrate(getById.get(info.lastInsertRowid)), duplicate: false };
}

const EDITABLE = ['url', 'title', 'description', 'favicon', 'preview_image', 'notes'];

export function updateBookmark(id, data) {
  const row = getById.get(id);
  if (!row) return null;

  const fields = [];
  const values = {};
  for (const key of EDITABLE) {
    if (data[key] === undefined) continue;
    if (key === 'url') {
      const url = ensureProtocol(data.url);
      const newKey = normalizeUrl(url);
      const clash = findByKey.get(newKey);
      if (clash && clash.id !== id) {
        const err = new Error('Another bookmark already uses that URL.');
        err.code = 'DUP_URL';
        err.existing = hydrate(clash);
        throw err;
      }
      fields.push('url = @url', 'url_key = @url_key', 'domain = @domain');
      values.url = url;
      values.url_key = newKey;
      values.domain = extractDomain(url);
    } else {
      fields.push(`${key} = @${key}`);
      values[key] = data[key];
    }
  }

  if (typeof data.read_later === 'boolean') {
    fields.push('read_later = @read_later');
    values.read_later = data.read_later ? 1 : 0;
  }
  if (typeof data.archived === 'boolean') {
    fields.push('archived = @archived');
    values.archived = data.archived ? 1 : 0;
  }

  if (fields.length) {
    fields.push('updated_at = @updated_at');
    values.updated_at = now();
    values.id = id;
    db.prepare(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = @id`).run(values);
  }

  if (data.tags !== undefined) setTags(id, data.tags);
  return hydrate(getById.get(id));
}

export function deleteBookmark(id) {
  return db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
}

// ---- Listing / search -----------------------------------------------------

export function listBookmarks({ query = '', scope = 'active', sort = 'created_desc', limit = 500, offset = 0 } = {}) {
  const parts = [scopeClause(scope)];
  const params = [];
  const search = buildSearch(query);
  if (search.where) {
    parts.push(search.where);
    params.push(...search.params);
  }
  const where = parts.filter(Boolean).join(' AND ');
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM bookmarks b WHERE ${where}`)
    .get(...params).c;
  const rows = db
    .prepare(
      `SELECT b.* FROM bookmarks b WHERE ${where} ORDER BY ${sortClause(sort)} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  return { total, bookmarks: rows.map(hydrate) };
}

export function counts() {
  const one = (sql) => db.prepare(sql).get().c;
  return {
    active: one('SELECT COUNT(*) AS c FROM bookmarks WHERE archived = 0'),
    read_later: one('SELECT COUNT(*) AS c FROM bookmarks WHERE read_later = 1 AND archived = 0'),
    archived: one('SELECT COUNT(*) AS c FROM bookmarks WHERE archived = 1'),
    all: one('SELECT COUNT(*) AS c FROM bookmarks'),
  };
}

// ---- Bulk actions ---------------------------------------------------------

export function bulkAction(ids, action, value) {
  if (!Array.isArray(ids) || !ids.length) return { affected: 0 };
  const idList = ids.map((n) => parseInt(n, 10)).filter(Number.isFinite);
  if (!idList.length) return { affected: 0 };
  const placeholders = idList.map(() => '?').join(',');
  const ts = now();
  let affected = 0;

  const run = (sql, extra = []) =>
    (affected = db.prepare(sql).run(...extra, ...idList).changes);

  switch (action) {
    case 'archive':
      run(`UPDATE bookmarks SET archived = 1, updated_at = ? WHERE id IN (${placeholders})`, [ts]);
      break;
    case 'unarchive':
      run(`UPDATE bookmarks SET archived = 0, updated_at = ? WHERE id IN (${placeholders})`, [ts]);
      break;
    case 'read_later':
      run(`UPDATE bookmarks SET read_later = 1, updated_at = ? WHERE id IN (${placeholders})`, [ts]);
      break;
    case 'unread_later':
      run(`UPDATE bookmarks SET read_later = 0, updated_at = ? WHERE id IN (${placeholders})`, [ts]);
      break;
    case 'delete':
      run(`DELETE FROM bookmarks WHERE id IN (${placeholders})`);
      break;
    case 'add_tag':
    case 'remove_tag': {
      const names = normalizeTagList(value);
      const tx = db.transaction(() => {
        for (const id of idList) {
          if (action === 'add_tag') {
            for (const name of names) {
              insertTag.run(name);
              const row = getTagByName.get(name);
              if (row) linkTag.run(id, row.id);
            }
          } else {
            for (const name of names) {
              const row = getTagByName.get(name);
              if (row) db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?').run(id, row.id);
            }
          }
          db.prepare('UPDATE bookmarks SET updated_at = ? WHERE id = ?').run(ts, id);
        }
      });
      tx();
      affected = idList.length;
      break;
    }
    default:
      return { affected: 0, error: 'unknown action' };
  }
  return { affected };
}

// ---- Saved filters --------------------------------------------------------

export function listSavedFilters() {
  return db.prepare('SELECT * FROM saved_filters ORDER BY name COLLATE NOCASE').all();
}

export function createSavedFilter({ name, query = '', scope = 'active', sort = 'created_desc' }) {
  const info = db
    .prepare('INSERT INTO saved_filters (name, query, scope, sort, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, query, scope, sort, now());
  return db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(info.lastInsertRowid);
}

export function deleteSavedFilter(id) {
  return db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id).changes > 0;
}

// ---- Snapshots ------------------------------------------------------------

export function addSnapshot(bookmarkId, { image_file, html_file, title }) {
  const info = db
    .prepare(
      'INSERT INTO snapshots (bookmark_id, image_file, html_file, title, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(bookmarkId, image_file || null, html_file || null, title || '', now());
  return db.prepare('SELECT * FROM snapshots WHERE id = ?').get(info.lastInsertRowid);
}

export function listSnapshots(bookmarkId) {
  return db
    .prepare('SELECT * FROM snapshots WHERE bookmark_id = ? ORDER BY created_at DESC')
    .all(bookmarkId);
}

export function getSnapshot(id) {
  return db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);
}

export function deleteSnapshot(id) {
  const snap = getSnapshot(id);
  db.prepare('DELETE FROM snapshots WHERE id = ?').run(id);
  return snap;
}

// ---- Preferences ----------------------------------------------------------

const DEFAULT_PREFS = {
  theme: 'auto',          // auto | light | dark
  view: 'grid',           // grid | list
  density: 'comfortable', // comfortable | compact
  show_previews: true,
  default_sort: 'created_desc',
};

export function getPreferences() {
  const rows = db.prepare('SELECT key, value FROM preferences').all();
  const prefs = { ...DEFAULT_PREFS };
  for (const { key, value } of rows) {
    try {
      prefs[key] = JSON.parse(value);
    } catch {
      prefs[key] = value;
    }
  }
  return prefs;
}

export function setPreferences(patch) {
  const stmt = db.prepare(
    'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in DEFAULT_PREFS)) continue;
      stmt.run(key, JSON.stringify(value));
    }
  });
  tx();
  return getPreferences();
}

// ---- Import / export ------------------------------------------------------

export function exportAll() {
  const rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at').all();
  return {
    version: 1,
    exported_at: now(),
    bookmarks: rows.map((r) => {
      const b = hydrate(r);
      return {
        url: b.url,
        title: b.title,
        description: b.description,
        favicon: b.favicon,
        preview_image: b.preview_image,
        notes: b.notes,
        read_later: b.read_later,
        archived: b.archived,
        tags: b.tags,
        created_at: b.created_at,
      };
    }),
    saved_filters: listSavedFilters().map(({ name, query, scope, sort }) => ({ name, query, scope, sort })),
  };
}

// Import bookmarks from an array of { url, title, ... }. Duplicates are skipped.
export function importBookmarks(items) {
  let imported = 0;
  let skipped = 0;
  const tx = db.transaction(() => {
    for (const item of items) {
      if (!item || !item.url) { skipped++; continue; }
      const { bookmark, duplicate } = createBookmark(item);
      if (duplicate) { skipped++; continue; }
      // Preserve created_at / archived when provided.
      const patch = {};
      if (item.archived) patch.archived = true;
      if (Object.keys(patch).length) updateBookmark(bookmark.id, patch);
      if (item.created_at) {
        db.prepare('UPDATE bookmarks SET created_at = ? WHERE id = ?').run(item.created_at, bookmark.id);
      }
      imported++;
    }
  });
  tx();
  return { imported, skipped };
}
