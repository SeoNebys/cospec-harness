/*
 * Domain logic over the store. Pure-ish and directly unit-testable (point
 * DATA_DIR at a temp dir). Maps closely to the approved scenarios.
 */
'use strict';
const store = require('./store');
const { fetchMetadata, normalizeUrl } = require('./metadata');
const { captureSnapshot } = require('./snapshot');
const { submitToArchive, archiveViewUrl } = require('./archive');

function normKey(url) {
  try {
    const u = new URL(/:\/\//.test(url) ? url : 'https://' + url);
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search).toLowerCase();
  } catch (e) { return (url || '').toLowerCase(); }
}
function uniq(arr) { return [...new Set(arr)]; }
function fullUrl(raw) { return /:\/\//.test(raw) ? raw : 'https://' + raw; }

function getState() {
  const db = store.load();
  return { bookmarks: db.bookmarks, savedSearches: db.savedSearches, preferences: db.preferences };
}

function findDuplicate(db, url) {
  const key = normKey(url);
  return db.bookmarks.find(b => !b.archived && normKey(b.url) === key) || null;
}

// SCN-001, SCN-008, SCN-009, SCN-010, SCN-019(auto)
async function createBookmark({ url, tags, note }) {
  const u = normalizeUrl(url);
  if (!u) return { status: 'invalid' };
  const db = store.load();
  const dup = findDuplicate(db, url);
  if (dup) return { status: 'duplicate', existingId: dup.id };

  const meta = await fetchMetadata(u.href);
  const now = Date.now();
  const id = store.nextId();
  const bm = {
    id,
    url: (meta.ok && meta.url) ? meta.url : u.href,
    title: meta.ok ? (meta.title || '') : '',
    description: meta.ok ? (meta.description || '') : '',
    site: meta.ok ? (meta.site || u.hostname.replace(/^www\./, '')) : u.hostname.replace(/^www\./, ''),
    icon: meta.ok ? (meta.icon || null) : null,
    preview: meta.ok ? (meta.image || null) : null,
    isPdf: !!(meta.ok && meta.isPdf),
    detailsMissing: !meta.ok,
    tags: uniq((tags || []).map(t => String(t).trim()).filter(Boolean)),
    note: note ? String(note) : '',
    readLater: false,
    archived: false,
    snapshot: null,
    archiveOrg: null,
    createdAt: now,
    updatedAt: now
  };
  store.mutate(d => { d.bookmarks.unshift(bm); });

  if (db.preferences.autoCopy && !bm.detailsMissing) {
    await snapshot(id); // best-effort; failure leaves bookmark intact
  }
  return { status: 'created', bookmark: store.load().bookmarks.find(b => b.id === id) };
}

function getBookmark(id) { return store.load().bookmarks.find(b => b.id === id) || null; }

// SCN-003, SCN-004, SCN-005, SCN-011, SCN-014
async function updateBookmark(id, patch) {
  const bm = getBookmark(id);
  if (!bm) return { status: 'not-found' };
  let refreshed = false;
  const urlChanged = patch.url !== undefined && normKey(patch.url) !== normKey(bm.url);
  store.mutate(() => {
    if (patch.title !== undefined) bm.title = String(patch.title);
    if (patch.description !== undefined) bm.description = String(patch.description);
    if (patch.note !== undefined) bm.note = String(patch.note);
    if (patch.tags !== undefined) bm.tags = uniq(patch.tags.map(t => String(t).trim()).filter(Boolean));
    if (patch.readLater !== undefined) bm.readLater = !!patch.readLater;
    if (patch.archived !== undefined) bm.archived = !!patch.archived;
    if (patch.url !== undefined && patch.url) bm.url = fullUrl(String(patch.url).trim());
    bm.updatedAt = Date.now();
  });
  if (urlChanged && patch.refresh) {
    const meta = await fetchMetadata(bm.url);
    if (meta.ok) {
      store.mutate(() => {
        bm.title = meta.title || bm.title;
        bm.description = meta.description || bm.description;
        bm.site = meta.site || bm.site;
        bm.icon = meta.icon || bm.icon;
        bm.preview = meta.image || null;
        bm.isPdf = !!meta.isPdf;
        bm.detailsMissing = false;
        bm.updatedAt = Date.now();
      });
      refreshed = true;
    }
  }
  return { status: 'ok', bookmark: getBookmark(id), refreshed };
}

// SCN-013
function deleteBookmark(id) {
  let removed = null, index = -1;
  store.mutate(d => {
    index = d.bookmarks.findIndex(b => b.id === id);
    if (index >= 0) removed = d.bookmarks.splice(index, 1)[0];
  });
  return removed ? { status: 'ok', removed, index } : { status: 'not-found' };
}

// undo support (single or bulk): re-insert preserving id/dates
function restoreBookmarks(entries) {
  store.mutate(d => {
    // insert in original order, keeping newest-ish placement stable
    entries.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).forEach(e => {
      if (!d.bookmarks.some(b => b.id === e.bookmark.id)) {
        const at = Math.min(Math.max(e.index ?? 0, 0), d.bookmarks.length);
        d.bookmarks.splice(at, 0, e.bookmark);
      }
    });
  });
  return { status: 'ok' };
}

// SCN-016, SCN-017
function bulk(ids, action, payload) {
  const set = new Set(ids || []);
  if (action === 'delete') {
    const removed = [];
    store.mutate(d => {
      for (let i = d.bookmarks.length - 1; i >= 0; i--) {
        if (set.has(d.bookmarks[i].id)) removed.unshift({ bookmark: d.bookmarks[i], index: i });
      }
      d.bookmarks = d.bookmarks.filter(b => !set.has(b.id));
    });
    return { status: 'ok', removed };
  }
  store.mutate(d => {
    d.bookmarks.forEach(b => {
      if (!set.has(b.id)) return;
      if (action === 'add-tag' && payload && payload.tag) { if (!b.tags.includes(payload.tag)) b.tags.push(payload.tag); }
      else if (action === 'remove-tag' && payload && payload.tag) { b.tags = b.tags.filter(t => t !== payload.tag); }
      else if (action === 'read-later') b.readLater = true;
      else if (action === 'mark-read') b.readLater = false;
      else if (action === 'archive') b.archived = true;
      else if (action === 'restore') b.archived = false;
      b.updatedAt = Date.now();
    });
  });
  return { status: 'ok', affected: ids.length };
}

// SCN-019
async function snapshot(id) {
  const bm = getBookmark(id);
  if (!bm) return { ok: false, reason: 'not-found' };
  const res = await captureSnapshot(id, bm.url);
  if (!res.ok) return { ok: false, reason: res.reason };
  store.mutate(() => { bm.snapshot = { savedAt: res.savedAt, kind: res.kind, file: res.file }; });
  return { ok: true, bookmark: getBookmark(id) };
}

// SCN-020
async function archiveOrg(id) {
  const bm = getBookmark(id);
  if (!bm) return { ok: false, reason: 'not-found' };
  const res = await submitToArchive(bm.url);
  if (!res.ok) return { ok: false, reason: res.reason };
  store.mutate(() => { bm.archiveOrg = { savedAt: res.savedAt, url: res.url || archiveViewUrl(bm.url) }; });
  return { ok: true, bookmark: getBookmark(id) };
}

// SCN-021 — bulk create from a parsed browser export, preserving title/date/tags.
function importBookmarks(items, opts) {
  const o = opts || {};
  const db = store.load();
  let imported = 0, skipped = 0;
  store.mutate(d => {
    (items || []).forEach(it => {
      const u = normalizeUrl(it.url);
      if (!u) { skipped++; return; }
      if (o.skipDupes !== false && d.bookmarks.some(b => normKey(b.url) === normKey(it.url))) { skipped++; return; }
      const folderTag = (o.addFolderTags !== false && it.folder) ? [String(it.folder).toLowerCase().replace(/\s+/g, '-')] : [];
      const created = it.added ? it.added * 1000 : Date.now();
      const id = store.nextId();
      d.bookmarks.push({
        id,
        url: fullUrl(it.url),
        title: it.title || u.href,
        description: '',
        site: u.hostname.replace(/^www\./, ''),
        icon: u.origin + '/favicon.ico',
        preview: null,
        isPdf: /\.pdf($|\?)/i.test(it.url),
        detailsMissing: false,
        tags: uniq([...(it.tags || []).map(t => String(t).trim()).filter(Boolean), ...folderTag]),
        note: '',
        readLater: false,
        archived: false,
        snapshot: null,
        archiveOrg: null,
        createdAt: created,
        updatedAt: created
      });
      imported++;
    });
  });
  return { status: 'ok', imported, skipped };
}

// SCN-018
function addSavedSearch(s) {
  const rec = { id: store.nextId(), name: s.name, query: s.query || '', tag: s.tag || null, view: s.view || 'all' };
  store.mutate(d => { d.savedSearches.push(rec); });
  return rec;
}
function removeSavedSearch(id) {
  store.mutate(d => { d.savedSearches = d.savedSearches.filter(s => s.id !== id); });
  return { status: 'ok' };
}

// SCN-023
function updatePreferences(patch) {
  store.mutate(d => { d.preferences = Object.assign({}, d.preferences, patch); });
  return store.load().preferences;
}

module.exports = {
  normKey, getState, createBookmark, getBookmark, updateBookmark,
  deleteBookmark, restoreBookmarks, bulk, snapshot, archiveOrg,
  importBookmarks, addSavedSearch, removeSavedSearch, updatePreferences
};
