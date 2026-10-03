'use strict';
const { db } = require('./db');
const { normalizeKey, canonicalHref, siteOf } = require('./lib/normalize');
const { makePredicate } = require('./lib/query');

const now = () => Date.now();

/* ---------- settings / preferences ---------- */
const DEFAULT_PREFS = { text_size: 'medium', density: 'comfortable', per_load: 50, default_sort: 'newest' };

function getPreferences() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const prefs = { ...DEFAULT_PREFS };
  for (const r of rows) {
    if (r.key in DEFAULT_PREFS) {
      try { prefs[r.key] = JSON.parse(r.value); } catch { prefs[r.key] = r.value; }
    }
  }
  return prefs;
}
function setPreferences(patch) {
  const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [k, v] of Object.entries(patch || {})) {
    if (k in DEFAULT_PREFS) up.run(k, JSON.stringify(v));
  }
  return getPreferences();
}

/* ---------- tags ---------- */
function ensureTag(name) {
  const clean = String(name).trim();
  if (!clean) return null;
  db.prepare('INSERT INTO tags(name) VALUES(?) ON CONFLICT(name) DO NOTHING').run(clean);
  return db.prepare('SELECT id FROM tags WHERE name=?').get(clean).id;
}
function setBookmarkTags(bookmarkId, names) {
  const uniq = [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))];
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(bookmarkId);
  const link = db.prepare('INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id) VALUES(?,?)');
  for (const n of uniq) { const id = ensureTag(n); if (id) link.run(bookmarkId, id); }
}
function tagsFor(bookmarkId) {
  return db.prepare(`SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id
                     WHERE bt.bookmark_id=? ORDER BY t.name`).all(bookmarkId).map(r => r.name);
}
function tagSuggestions(q, limit = 8) {
  const query = String(q || '').trim().toLowerCase();
  const rows = db.prepare('SELECT name FROM tags ORDER BY name').all().map(r => r.name);
  if (!query) return rows.slice(0, limit);
  return rows.filter(n => n.toLowerCase().includes(query)).slice(0, limit);
}

/* ---------- serialization ---------- */
function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    site: row.site,
    favicon: row.favicon || null,
    preview_image: row.preview_image || null,
    note: row.note,
    status: row.status,
    archived: !!row.archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    copy: { status: row.copy_status, kind: row.copy_kind, size: row.copy_size, saved_at: row.copy_saved_at },
    ia: { status: row.ia_status, url: row.ia_url, saved_at: row.ia_saved_at },
    tags: tagsFor(row.id)
  };
}
function getBookmark(id) {
  return hydrate(db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id));
}
function findByKey(urlKey) {
  return hydrate(db.prepare('SELECT * FROM bookmarks WHERE url_key=?').get(urlKey));
}

/* ---------- create (with dedup, SCN-006) ---------- */
function createBookmark(input) {
  const key = normalizeKey(input.url);
  if (!key) return { error: 'invalid_url' };
  const existing = findByKey(key);
  if (existing) return { duplicate: true, bookmark: existing };

  const url = canonicalHref(input.url) || input.url;
  const ts = input.created_at || now();
  const info = db.prepare(`INSERT INTO bookmarks
     (url,url_key,title,description,site,favicon,preview_image,note,status,archived,created_at,updated_at,copy_status,copy_kind)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    url, key, input.title || url, input.description || '', input.site || siteOf(url),
    input.favicon || null, input.preview_image || null, input.note || '',
    input.status === 'finished' ? 'finished' : 'toread',
    input.archived ? 1 : 0, ts, input.updated_at || ts,
    input.copy_status || 'pending', input.copy_kind || null
  );
  const id = Number(info.lastInsertRowid);
  setBookmarkTags(id, input.tags || []);
  return { created: true, bookmark: getBookmark(id) };
}

/* ---------- update (SCN-001/002/004) ---------- */
const MEANINGFUL = ['url', 'title', 'description', 'note', 'status', 'archived', 'tags'];
function updateBookmark(id, patch) {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id);
  if (!row) return null;
  const sets = [];
  const vals = [];
  let meaningful = false;
  if (patch.url != null && patch.url !== row.url) {
    const key = normalizeKey(patch.url);
    if (key) {
      const clash = db.prepare('SELECT id FROM bookmarks WHERE url_key=? AND id<>?').get(key, id);
      if (clash) return { error: 'duplicate_url', existingId: clash.id };
      sets.push('url=?', 'url_key=?', 'site=?');
      vals.push(canonicalHref(patch.url) || patch.url, key, siteOf(patch.url));
      meaningful = true;
    }
  }
  for (const f of ['title', 'description', 'note']) {
    if (patch[f] != null && patch[f] !== row[f]) { sets.push(`${f}=?`); vals.push(patch[f]); meaningful = true; }
  }
  if (patch.status && patch.status !== row.status) { sets.push('status=?'); vals.push(patch.status === 'finished' ? 'finished' : 'toread'); meaningful = true; }
  if (patch.archived != null && (patch.archived ? 1 : 0) !== row.archived) { sets.push('archived=?'); vals.push(patch.archived ? 1 : 0); meaningful = true; }
  if (patch.tags) { setBookmarkTags(id, patch.tags); meaningful = true; }
  if (meaningful) { sets.push('updated_at=?'); vals.push(now()); }
  if (sets.length) { db.prepare(`UPDATE bookmarks SET ${sets.join(',')} WHERE id=?`).run(...vals, id); }
  return getBookmark(id);
}

function setCopy(id, fields) {
  const map = { status: 'copy_status', kind: 'copy_kind', path: 'copy_path', size: 'copy_size', saved_at: 'copy_saved_at' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) if (k in fields) { sets.push(`${col}=?`); vals.push(fields[k]); }
  if (sets.length) db.prepare(`UPDATE bookmarks SET ${sets.join(',')} WHERE id=?`).run(...vals, id);
  return getBookmark(id);
}
function setIA(id, fields) {
  const map = { status: 'ia_status', url: 'ia_url', saved_at: 'ia_saved_at' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) if (k in fields) { sets.push(`${col}=?`); vals.push(fields[k]); }
  if (sets.length) db.prepare(`UPDATE bookmarks SET ${sets.join(',')} WHERE id=?`).run(...vals, id);
  return getBookmark(id);
}
function copyPath(id) {
  const row = db.prepare('SELECT copy_path FROM bookmarks WHERE id=?').get(id);
  return row ? row.copy_path : null;
}

function deleteBookmark(id) {
  const info = db.prepare('DELETE FROM bookmarks WHERE id=?').run(id);
  return info.changes > 0;
}

/* ---------- listing / whole-collection query (SCN-003/004/009/010) ---------- */
function truthy(v) { return v === true || v === 1 || v === '1' || v === 'true'; }
function scopeRows({ archived, status }) {
  const arch = truthy(archived);
  let sql = 'SELECT * FROM bookmarks WHERE archived=?';
  const args = [arch ? 1 : 0];
  if (!arch && (status === 'toread' || status === 'finished')) { sql += ' AND status=?'; args.push(status); }
  return db.prepare(sql).all(...args).map(hydrate);
}
const SORTERS = {
  newest: (a, b) => b.created_at - a.created_at,
  oldest: (a, b) => a.created_at - b.created_at,
  updated: (a, b) => b.updated_at - a.updated_at,
  az: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  za: (a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' })
};
function matchedSorted({ query, status, archived, sort }) {
  let rows = scopeRows({ archived, status });
  const q = String(query || '').trim();
  if (q) { const pred = makePredicate(q); rows = rows.filter(pred); }
  const sorter = SORTERS[sort] || SORTERS[getPreferences().default_sort] || SORTERS.newest;
  rows.sort(sorter);
  return rows;
}
function listBookmarks(params) {
  const rows = matchedSorted(params);
  const offset = Math.max(0, params.offset | 0);
  const limit = params.limit != null ? Math.max(1, params.limit | 0) : getPreferences().per_load;
  return { total: rows.length, items: rows.slice(offset, offset + limit) };
}
function matchingIds(params) {
  return matchedSorted(params).map(b => b.id);
}

/* ---------- bulk (SCN-012) ---------- */
function resolveIds(sel) {
  if (sel.ids && Array.isArray(sel.ids)) return sel.ids.map(Number);
  if (sel.match) return matchingIds(sel.match);
  return [];
}
function bulk(action, sel, payload = {}) {
  const ids = resolveIds(sel);
  let affected = 0;
  for (const id of ids) {
    const row = db.prepare('SELECT id FROM bookmarks WHERE id=?').get(id);
    if (!row) continue;
    if (action === 'markRead') updateBookmark(id, { status: 'finished' });
    else if (action === 'markUnread') updateBookmark(id, { status: 'toread' });
    else if (action === 'archive') updateBookmark(id, { archived: true });
    else if (action === 'restore') updateBookmark(id, { archived: false });
    else if (action === 'delete') deleteBookmark(id);
    else if (action === 'addTags') {
      const cur = tagsFor(id);
      updateBookmark(id, { tags: [...new Set([...cur, ...(payload.tags || [])])] });
    } else if (action === 'removeTags') {
      const rm = new Set((payload.tags || []).map(t => String(t)));
      updateBookmark(id, { tags: tagsFor(id).filter(t => !rm.has(t)) });
    } else continue;
    affected++;
  }
  return { affected };
}

/* ---------- collections (SCN-014) ---------- */
function listCollections() {
  return db.prepare('SELECT * FROM collections ORDER BY name').all().map(c => ({
    id: c.id, name: c.name, text: c.text,
    inc: JSON.parse(c.inc_tags), exc: JSON.parse(c.exc_tags), created_at: c.created_at
  }));
}
function saveCollection({ name, text, inc, exc }) {
  const clean = String(name || '').trim() || 'Untitled collection';
  const existing = db.prepare('SELECT id FROM collections WHERE name=?').get(clean);
  if (existing) {
    db.prepare('UPDATE collections SET text=?, inc_tags=?, exc_tags=? WHERE id=?')
      .run(text || '', JSON.stringify(inc || []), JSON.stringify(exc || []), existing.id);
    return db.prepare('SELECT * FROM collections WHERE id=?').get(existing.id);
  }
  const info = db.prepare('INSERT INTO collections(name,text,inc_tags,exc_tags,created_at) VALUES(?,?,?,?,?)')
    .run(clean, text || '', JSON.stringify(inc || []), JSON.stringify(exc || []), now());
  return db.prepare('SELECT * FROM collections WHERE id=?').get(Number(info.lastInsertRowid));
}
function deleteCollection(id) {
  return db.prepare('DELETE FROM collections WHERE id=?').run(id).changes > 0;
}
// Build a query string from a collection definition + extra search text.
function collectionQuery(coll, extraText) {
  const parts = [];
  if (coll.text) parts.push(coll.text);
  if (extraText) parts.push(extraText);
  for (const t of coll.inc || []) parts.push('#' + t);
  for (const t of coll.exc || []) parts.push('NOT #' + t);
  return parts.join(' ');
}

/* ---------- import / export (SCN-015) ---------- */
function importRecords(records, { addToRead = false } = {}) {
  let imported = 0, existed = 0, skipped = 0;
  const newIds = [];
  for (const r of records) {
    const key = normalizeKey(r.url);
    if (!key) { skipped++; continue; }
    if (findByKey(key)) { existed++; continue; }
    const res = createBookmark({
      url: r.url,
      title: r.title || r.url,
      note: r.note || '',
      tags: r.tags || [],
      status: r.status || (addToRead ? 'toread' : 'toread'),
      archived: !!r.archived,
      created_at: r.addDate || now(),
      copy_status: 'pending'
    });
    if (res.created) { imported++; newIds.push(res.bookmark.id); }
    else existed++;
  }
  return { imported, existed, skipped, newIds };
}
function exportRecords({ scope, params }) {
  let rows;
  if (scope === 'view' && params) rows = matchedSorted({ ...params });
  else {
    let sql = 'SELECT * FROM bookmarks';
    if (scope !== 'all-archived') sql += ' WHERE archived=0';
    rows = db.prepare(sql).all().map(hydrate);
  }
  return rows.map(b => ({
    url: b.url, title: b.title, created_at: b.created_at, tags: b.tags,
    note: b.note, status: b.status, archived: b.archived
  }));
}

function countAll() {
  return db.prepare('SELECT COUNT(*) n FROM bookmarks').get().n;
}

module.exports = {
  getPreferences, setPreferences, tagSuggestions,
  getBookmark, findByKey, createBookmark, updateBookmark, deleteBookmark,
  setCopy, setIA, copyPath, listBookmarks, matchingIds, bulk,
  listCollections, saveCollection, deleteCollection, collectionQuery,
  importRecords, exportRecords, countAll, hydrate
};
