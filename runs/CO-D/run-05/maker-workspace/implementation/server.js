/*
 * Bookmarks app — HTTP server and JSON API (Phase 2 implementation).
 * Serves the single-user web app and persists everything to durable storage.
 * See design/scenario-map.md for the scenario→code mapping.
 */
const path = require('path');
const express = require('express');
const { Store } = require('./lib/store');
const { fetchMetadata, hostOf, isPdfUrl } = require('./lib/metadata');
const { savePageCopy, requestInternetArchive, iaLink } = require('./lib/archive');
const bookmarksHtml = require('./lib/bookmarksHtml');

const DATA_DIR = process.env.BM_DATA_DIR || path.join(__dirname, 'data');
const store = new Store(DATA_DIR);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: 'text/html', limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Expose the universal search module to the browser (single source of truth).
app.use('/vendor', express.static(path.join(__dirname, 'lib')));

const isValidUrl = (u) => { try { new URL(u); return true; } catch (e) { return false; } };

// --- read whole state ------------------------------------------------------
app.get('/api/state', (req, res) => {
  res.json({ bookmarks: store.all(), prefs: store.prefs(), savedSearches: store.savedSearches() });
});

// --- live metadata lookup for the save form (SCN-001, SCN-002, SCN-015) ----
app.post('/api/metadata', async (req, res) => {
  const { url } = req.body || {};
  if (!isValidUrl(url)) return res.status(400).json({ ok: false, error: 'invalid-url' });
  const meta = await fetchMetadata(url);
  res.json(meta);
});

// --- create (or, for a duplicate address, update in place) SCN-001/003 -----
app.post('/api/bookmarks', async (req, res) => {
  const body = req.body || {};
  if (!isValidUrl(body.url)) return res.status(400).json({ ok: false, error: 'invalid-url' });
  const host = hostOf(body.url);
  const fields = {
    url: body.url,
    title: (body.title && body.title.trim()) || body.url, // SCN-002 fallback
    desc: body.desc || '',
    site: host,
    letter: (host[0] || '?').toUpperCase(),
    tags: Array.isArray(body.tags) ? body.tags : [],
    note: body.note || '',
    favicon: body.favicon || null,
    image: body.image || null,
    keepCopy: body.keepCopy !== false,
    isPdf: isPdfUrl(body.url),
    ia: !!body.ia,
  };

  const existing = store.findByAddress(body.url);
  let bookmark;
  if (existing) {
    // SCN-003: editing a duplicate updates in place; preserve status/archived.
    bookmark = store.update(existing.id, {
      url: fields.url, title: fields.title, desc: fields.desc,
      tags: fields.tags, note: fields.note, keepCopy: fields.keepCopy, ia: fields.ia,
    });
  } else {
    bookmark = store.create(Object.assign({ status: 'toread', archived: false }, fields));
  }

  await applyCopyAndArchive(bookmark);
  res.json({ ok: true, duplicate: !!existing, bookmark: store.get(bookmark.id) });
});

// Perform preserved-copy capture and Internet Archive request for a bookmark.
async function applyCopyAndArchive(bookmark) {
  if (bookmark.ia && !bookmark.iaUrl) {
    const url = requestInternetArchive(bookmark.url);
    store.update(bookmark.id, { iaUrl: url });
  } else if (!bookmark.ia) {
    store.update(bookmark.id, { iaUrl: null });
  }
  if (bookmark.keepCopy) {
    const snap = await savePageCopy(bookmark.url, bookmark.id, store.snapshotsDir);
    store.update(bookmark.id, { hasSnapshot: !!snap.hasSnapshot, snapshotType: snap.snapshotType || null, snapshotFile: snap.snapshotFile || null });
  } else {
    store.update(bookmark.id, { hasSnapshot: false, snapshotType: null, snapshotFile: null });
  }
}

// --- edit fields (SCN-005) -------------------------------------------------
app.put('/api/bookmarks/:id', async (req, res) => {
  const id = +req.params.id;
  const b = store.get(id);
  if (!b) return res.status(404).json({ ok: false });
  const body = req.body || {};
  if (body.url != null && !isValidUrl(body.url)) return res.status(400).json({ ok: false, error: 'invalid-url' });
  const patch = {};
  ['title', 'desc', 'note'].forEach(k => { if (body[k] != null) patch[k] = body[k]; });
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (body.url != null) { patch.url = body.url; patch.site = hostOf(body.url); patch.isPdf = isPdfUrl(body.url); }
  if (body.keepCopy != null) patch.keepCopy = !!body.keepCopy;
  if (body.ia != null) patch.ia = !!body.ia;
  if (body.title != null && !String(body.title).trim() && patch.url) patch.title = patch.url;
  const updated = store.update(id, patch);
  if (body.keepCopy != null || body.ia != null || body.url != null) await applyCopyAndArchive(store.get(id));
  res.json({ ok: true, bookmark: store.get(id) });
});

// --- status / archive changes (SCN-004, SCN-006) ---------------------------
app.patch('/api/bookmarks/:id', (req, res) => {
  const id = +req.params.id;
  const b = store.get(id);
  if (!b) return res.status(404).json({ ok: false });
  const patch = {};
  if (req.body.status === 'toread' || req.body.status === 'done') patch.status = req.body.status;
  if (typeof req.body.archived === 'boolean') patch.archived = req.body.archived;
  res.json({ ok: true, bookmark: store.update(id, patch) });
});

// --- delete (SCN-007) ------------------------------------------------------
app.delete('/api/bookmarks/:id', (req, res) => {
  res.json({ ok: store.remove(+req.params.id) });
});

// --- bulk actions (SCN-017) ------------------------------------------------
app.post('/api/bookmarks/bulk', (req, res) => {
  const { ids, action, value } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ ok: false });
  const targets = ids.map(id => store.get(id)).filter(Boolean);
  for (const b of targets) {
    switch (action) {
      case 'status': if (value === 'toread' || value === 'done') b.status = value; break;
      case 'archive': b.archived = true; break;         // preserves each b.status (SCN-006/017)
      case 'restore': b.archived = false; break;
      case 'addTag': if (value && !b.tags.includes(value)) b.tags.push(value); break;
      case 'removeTag': b.tags = b.tags.filter(t => t !== value); break;
      case 'delete': break;
    }
  }
  if (action === 'delete') ids.forEach(id => store.remove(id));
  else store._save();
  res.json({ ok: true });
});

// --- serve a preserved copy (SCN-019) --------------------------------------
app.get('/api/bookmarks/:id/copy', (req, res) => {
  const b = store.get(+req.params.id);
  if (!b || !b.hasSnapshot || !b.snapshotFile) return res.status(404).send('No preserved copy.');
  res.sendFile(path.join(store.snapshotsDir, b.snapshotFile));
});

// --- preferences (SCN-014, SCN-022) ----------------------------------------
app.put('/api/prefs', (req, res) => {
  const p = {};
  if (['added_desc', 'added_asc', 'title_asc', 'title_desc'].includes(req.body.sortKey)) p.sortKey = req.body.sortKey;
  if ([10, 25, 50].includes(+req.body.pageSize)) p.pageSize = +req.body.pageSize;
  if (['s', 'm', 'l'].includes(req.body.textSize)) p.textSize = req.body.textSize;
  res.json({ ok: true, prefs: store.setPrefs(p) });
});

// --- saved searches (SCN-020) ----------------------------------------------
app.post('/api/searches', (req, res) => {
  const { name, query, view } = req.body || {};
  if (!name || query == null) return res.status(400).json({ ok: false });
  res.json({ ok: true, search: store.addSearch({ name, query, view: view || 'toread' }) });
});
app.delete('/api/searches/:id', (req, res) => {
  res.json({ ok: store.removeSearch(+req.params.id) });
});

// --- import (SCN-021) ------------------------------------------------------
app.post('/api/import', (req, res) => {
  const html = typeof req.body === 'string' ? req.body : (req.body && req.body.html) || '';
  const entries = bookmarksHtml.parse(html);
  let added = 0, skipped = 0;
  for (const e of entries) {
    if (store.findByAddress(e.url)) { skipped++; continue; }
    const host = hostOf(e.url);
    store.create({
      url: e.url, title: e.title, desc: '', site: host, letter: (host[0] || '?').toUpperCase(),
      tags: e.tags, note: e.note, favicon: null, image: null,
      status: 'toread', archived: false, keepCopy: true, isPdf: isPdfUrl(e.url),
      hasSnapshot: false, ia: false, iaUrl: null, createdAt: e.createdAt,
    });
    added++;
  }
  res.json({ ok: true, added, skipped });
});

// --- export (SCN-021) ------------------------------------------------------
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(bookmarksHtml.generate(store.all()));
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`Bookmarks app on http://0.0.0.0:${PORT}`));
}
module.exports = { app, store };
