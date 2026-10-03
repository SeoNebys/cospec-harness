'use strict';
const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { DATA_DIR } = require('./db');
const repo = require('./repo');
const { fetchMetadata, captureCopy, submitInternetArchive } = require('./lib/metadata');
const { parseBookmarksHtml, buildBookmarksHtml } = require('./lib/bookmarksHtml');

const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const COPIES_DIR = path.join(DATA_DIR, 'copies');

/* ---------- background copy capture (non-blocking, SCN-013) ---------- */
function scheduleCapture(id, url) {
  repo.setCopy(id, { status: 'pending' });
  setImmediate(async () => {
    const res = await captureCopy(url, id, COPIES_DIR);
    if (res.status === 'saved') repo.setCopy(id, res);
    else repo.setCopy(id, { status: 'failed' });
  });
}

const parseArchived = (v) => v === '1' || v === 'true' || v === true;
const listParams = (q) => ({
  query: q.query || '',
  status: q.status || 'all',
  archived: parseArchived(q.archived),
  sort: q.sort || repo.getPreferences().default_sort,
  offset: q.offset != null ? parseInt(q.offset, 10) : 0,
  limit: q.limit != null ? parseInt(q.limit, 10) : undefined
});

/* ---------- preview (metadata + dedup) SCN-001/006/007 ---------- */
app.post('/api/preview', async (req, res) => {
  const { url } = req.body || {};
  const { normalizeKey } = require('./lib/normalize');
  const key = normalizeKey(url);
  if (!key) return res.json({ error: 'invalid_url' });
  const existing = repo.findByKey(key);
  if (existing) return res.json({ duplicate: true, bookmark: existing });
  const meta = await fetchMetadata(url);
  res.json({
    draft: {
      url, title: meta.title, description: meta.description, site: meta.site,
      favicon: meta.favicon, preview_image: meta.preview_image, isPdf: meta.isPdf, readable: meta.ok
    }
  });
});

/* ---------- create SCN-001/002/004/013 ---------- */
app.post('/api/bookmarks', (req, res) => {
  const b = req.body || {};
  const result = repo.createBookmark({
    url: b.url, title: b.title, description: b.description, note: b.note,
    tags: b.tags, status: b.status, favicon: b.favicon, preview_image: b.preview_image
  });
  if (result.error) return res.status(400).json(result);
  if (result.duplicate) return res.status(409).json(result);
  scheduleCapture(result.bookmark.id, result.bookmark.url);
  res.status(201).json(result);
});

/* ---------- list / whole-collection SCN-003/004/009/010 ---------- */
app.get('/api/bookmarks', (req, res) => {
  res.json(repo.listBookmarks(listParams(req.query)));
});
app.get('/api/bookmarks/matching-ids', (req, res) => {
  res.json({ ids: repo.matchingIds(listParams(req.query)) });
});
app.get('/api/bookmarks/:id', (req, res) => {
  const b = repo.getBookmark(+req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  res.json(b);
});
app.put('/api/bookmarks/:id', (req, res) => {
  const out = repo.updateBookmark(+req.params.id, req.body || {});
  if (!out) return res.status(404).json({ error: 'not_found' });
  if (out.error) return res.status(409).json(out);
  res.json(out);
});
app.post('/api/bookmarks/:id/archive', (req, res) => res.json(repo.updateBookmark(+req.params.id, { archived: true })));
app.post('/api/bookmarks/:id/restore', (req, res) => res.json(repo.updateBookmark(+req.params.id, { archived: false })));
app.delete('/api/bookmarks/:id', (req, res) => res.json({ deleted: repo.deleteBookmark(+req.params.id) }));

/* ---------- bulk SCN-012 ---------- */
app.post('/api/bookmarks/bulk', (req, res) => {
  const { action, ids, match, tags } = req.body || {};
  res.json(repo.bulk(action, { ids, match }, { tags }));
});

/* ---------- preserved copy SCN-013/017 ---------- */
app.post('/api/bookmarks/:id/copy/retry', (req, res) => {
  const b = repo.getBookmark(+req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  scheduleCapture(b.id, b.url);
  res.json({ status: 'pending' });
});
app.get('/api/bookmarks/:id/copy', (req, res) => {
  const b = repo.getBookmark(+req.params.id);
  if (!b || b.copy.status !== 'saved') return res.status(404).send('No saved copy.');
  const file = repo.copyPath(b.id);
  if (!file || !fs.existsSync(file)) return res.status(404).send('Copy file missing.');
  res.type(b.copy.kind === 'pdf' ? 'application/pdf' : 'text/html');
  res.send(fs.readFileSync(file));
});

/* ---------- internet archive (opt-in) SCN-013/017 ---------- */
app.post('/api/bookmarks/:id/internet-archive', (req, res) => {
  const b = repo.getBookmark(+req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  repo.setIA(b.id, { status: 'pending' });
  setImmediate(async () => {
    const out = await submitInternetArchive(b.url);
    repo.setIA(b.id, out.status === 'saved' ? out : { status: 'failed' });
  });
  res.json({ status: 'pending' });
});

/* ---------- tags ---------- */
app.get('/api/tags', (req, res) => res.json({ tags: repo.tagSuggestions(req.query.q) }));

/* ---------- collections SCN-014 ---------- */
app.get('/api/collections', (req, res) => res.json({ collections: repo.listCollections() }));
app.post('/api/collections', (req, res) => res.json(repo.saveCollection(req.body || {})));
app.delete('/api/collections/:id', (req, res) => res.json({ deleted: repo.deleteCollection(+req.params.id) }));

/* ---------- preferences SCN-016 ---------- */
app.get('/api/preferences', (req, res) => res.json(repo.getPreferences()));
app.put('/api/preferences', (req, res) => res.json(repo.setPreferences(req.body || {})));

/* ---------- import / export SCN-015/017 ---------- */
app.post('/api/import/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok: false });
  const { ok, records } = parseBookmarksHtml(req.file.buffer.toString('utf8'), { folderTags: true });
  if (!ok) return res.json({ ok: false });
  let neu = 0, existed = 0, skipped = 0;
  const { normalizeKey } = require('./lib/normalize');
  for (const r of records) {
    const key = normalizeKey(r.url);
    if (!key) { skipped++; continue; }
    if (repo.findByKey(key)) existed++; else neu++;
  }
  res.json({ ok: true, total: records.length, neu, existed, skipped });
});
app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok: false });
  const folderTags = req.body.folderTags !== 'false';
  const addToRead = req.body.addToRead === 'true';
  const { ok, records } = parseBookmarksHtml(req.file.buffer.toString('utf8'), { folderTags });
  if (!ok) return res.json({ ok: false });
  const result = repo.importRecords(records, { addToRead });
  for (const id of result.newIds) {
    const bk = repo.getBookmark(id);
    if (bk) scheduleCapture(id, bk.url);
  }
  res.json({ ok: true, ...result });
});
app.get('/api/export', (req, res) => {
  const scope = req.query.scope || 'all';
  const records = repo.exportRecords({ scope, params: listParams(req.query) });
  const html = buildBookmarksHtml(records);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(html);
});

/* ---------- static frontend ---------- */
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`Bookmarks app listening on http://0.0.0.0:${PORT}`));
}
module.exports = app;
