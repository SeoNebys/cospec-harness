/*
 * Bookmarks app server — REST API + static frontend.
 * Scenario map is in implementation/SCENARIO-MAP.md.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Store } = require('./lib/store');
const { normalizeUrl, dupKey } = require('./lib/normalize');
const bookmarksHtml = require('./lib/bookmarks-html');
const meta = require('./lib/metadata');

const DATA_DIR = process.env.BM_DATA_DIR || path.join(__dirname, 'data');
const SNAP_DIR = path.join(DATA_DIR, 'snapshots');
const store = new Store(path.join(DATA_DIR, 'store.json'));

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: 'text/html', limit: '10mb' }));

// ---- bookmarks ----
app.get('/api/bookmarks', (req, res) => res.json({ bookmarks: store.all() }));

app.post('/api/bookmarks', (req, res) => {
  const r = store.create(req.body || {});
  if (r.error) return res.status(400).json(r);
  if (r.duplicate) return res.status(200).json({ duplicate: r.duplicate });
  res.status(201).json({ bookmark: r.bookmark });
});

app.patch('/api/bookmarks/:id', (req, res) => {
  const r = store.update(req.params.id, req.body || {});
  if (r.error === 'not-found') return res.status(404).json(r);
  if (r.error) return res.status(400).json(r);
  res.json({ bookmark: r.bookmark });
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const r = store.remove(req.params.id);
  if (r.error) return res.status(404).json(r);
  res.json({ ok: true });
});

// bulk: {ids:[], action, tag?} — add-tag, remove-tag, read, unread, archive, unarchive, delete
app.post('/api/bookmarks/bulk', (req, res) => {
  const { ids = [], action, tag } = req.body || {};
  let n = 0;
  for (const id of ids) {
    const b = store.find(id);
    if (!b) continue;
    if (action === 'add-tag' && tag) { if (!b.tags.includes(tag)) { store.update(id, { tags: b.tags.concat(tag) }); n++; } }
    else if (action === 'remove-tag' && tag) { if (b.tags.includes(tag)) { store.update(id, { tags: b.tags.filter(t => t !== tag) }); n++; } }
    else if (action === 'read') { store.update(id, { readLater: true, _touch: false }); n++; }
    else if (action === 'unread') { store.update(id, { readLater: false, _touch: false }); n++; }
    else if (action === 'archive') { store.update(id, { archived: true, _touch: false }); n++; }
    else if (action === 'unarchive') { store.update(id, { archived: false, _touch: false }); n++; }
    else if (action === 'delete') { store.remove(id); n++; }
  }
  res.json({ ok: true, affected: n, bookmarks: store.all() });
});

// ---- metadata / preservation (external services; honest degradation) ----
app.post('/api/metadata', async (req, res) => {
  const r = await meta.collectMetadata((req.body || {}).url || '');
  res.json(r);
});

app.post('/api/bookmarks/:id/snapshot', async (req, res) => {
  const b = store.find(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  const r = await meta.saveSnapshot(b.url, SNAP_DIR, b.id);
  if (!r.ok) return res.status(502).json({ ok: false, reason: r.reason }); // bookmark untouched
  const snapshot = { status: 'done', at: r.at, kind: r.kind, file: r.file };
  store.update(b.id, { snapshot, _touch: false });
  res.json({ ok: true, snapshot });
});

app.get('/api/bookmarks/:id/snapshot', (req, res) => {
  const b = store.find(req.params.id);
  if (!b || !b.snapshot || !b.snapshot.file) return res.status(404).send('No saved copy.');
  const f = path.join(SNAP_DIR, b.snapshot.file);
  if (!fs.existsSync(f)) return res.status(404).send('Saved copy missing.');
  res.type(b.snapshot.kind === 'pdf' ? 'application/pdf' : 'text/html');
  fs.createReadStream(f).pipe(res);
});

app.post('/api/bookmarks/:id/archive', async (req, res) => {
  const b = store.find(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  if (!(req.body && req.body.confirmPublic === true)) return res.status(400).json({ error: 'confirm-required' });
  const r = await meta.createArchive(b.url);
  if (!r.ok) return res.status(502).json({ ok: false, reason: r.reason });
  store.update(b.id, { archiveUrl: r.archiveUrl, _touch: false });
  res.json({ ok: true, archiveUrl: r.archiveUrl });
});

// ---- import / export (SCN-019) ----
app.get('/api/export', (req, res) => {
  res.type('text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(bookmarksHtml.exportHtml(store.all()));
});

app.post('/api/import', (req, res) => {
  const text = typeof req.body === 'string' ? req.body : (req.body && req.body.html) || '';
  const entries = bookmarksHtml.parseHtml(text);
  let added = 0, skipped = 0;
  for (const e of entries) {
    const u = normalizeUrl(e.url);
    if (!u) { skipped++; continue; }
    if (store.findByKey(u.href)) { skipped++; continue; }
    const r = store.create({ url: u.href, title: e.title, tags: e.tags, addedAt: e.addedAt || Date.now(), updatedAt: e.updatedAt || e.addedAt || Date.now() });
    if (r.bookmark) added++; else skipped++;
  }
  res.json({ added, skipped, bookmarks: store.all() });
});

// ---- settings ----
app.get('/api/settings', (req, res) => res.json({ settings: store.getSettings() }));
app.put('/api/settings', (req, res) => res.json({ settings: store.setSettings(req.body || {}) }));

// ---- collections ----
app.get('/api/collections', (req, res) => res.json({ collections: store.getCollections() }));
app.post('/api/collections', (req, res) => {
  const { name, query, tags } = req.body || {};
  const r = store.addCollection(name, query, tags);
  if (r.error) return res.status(400).json(r);
  res.status(201).json({ collection: r.collection });
});
app.delete('/api/collections/:id', (req, res) => {
  const r = store.removeCollection(req.params.id);
  if (r.error) return res.status(404).json(r);
  res.json({ ok: true });
});

// ---- static frontend ----
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`Bookmarks app on http://0.0.0.0:${PORT}`));
}
module.exports = app;
