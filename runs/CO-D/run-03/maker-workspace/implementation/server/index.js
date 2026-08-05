'use strict';
// HTTP server: REST API over the store, plus serving the browser app.

const path = require('path');
const express = require('express');
const { createStore } = require('./store');
const { capture } = require('./capture');

// Data folder: an explicit path argument wins (used by the Windows launcher so
// everything lives next to the app), then an env override, then a local default.
const DATA_DIR = process.argv[2] || process.env.BOOKMARKS_DATA || path.join(__dirname, '..', 'data');
const PORT = process.env.PORT || 4000;

const store = createStore({ dataDir: DATA_DIR, capture });
// Purge soft-deleted items whose undo window has passed.
setInterval(() => store.purgeExpired(), 5000).unref();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: ['text/html', 'text/plain'], limit: '25mb' })); // imported files

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  if (err && err.code === 'invalid') return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.get('/api/bookmarks', wrap((req, res) => {
  res.json(store.list({ view: req.query.view, label: req.query.label || null }));
}));

app.get('/api/search', wrap((req, res) => {
  res.json(store.search({ q: req.query.q || '', view: req.query.view, label: req.query.label || null }));
}));

app.get('/api/bookmarks/:id/copy', wrap((req, res) => {
  const c = store.getCopy(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
}));

app.post('/api/bookmarks', wrap(async (req, res) => {
  const result = await store.create({ url: req.body.url, unread: req.body.unread });
  res.status(result.status === 'created' ? 201 : 200).json(result);
}));

app.patch('/api/bookmarks/:id', wrap((req, res) => {
  const item = store.update(req.params.id, req.body || {});
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ item });
}));

app.post('/api/bookmarks/:id/refetch', wrap(async (req, res) => {
  const r = await store.refetch(req.params.id, { url: req.body.url });
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
}));

app.post('/api/bookmarks/:id/toread', wrap((req, res) => {
  const item = store.setToRead(req.params.id, req.body.value);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ item });
}));

app.post('/api/bookmarks/:id/archive', wrap((req, res) => {
  const item = store.setArchived(req.params.id, req.body.value);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ item });
}));

app.delete('/api/bookmarks/:id', wrap((req, res) => {
  const r = store.remove(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
}));

app.post('/api/bookmarks/:id/undelete', wrap((req, res) => {
  const item = store.undelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ item });
}));

app.post('/api/import', wrap((req, res) => {
  const foldersAsLabels = req.query.folders !== 'false';
  const job = store.importStart(req.body || '', { foldersAsLabels });
  res.json({ jobId: job.id, total: job.total });
}));

app.get('/api/import/:jobId', wrap((req, res) => {
  const job = store.importStatus(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
}));

app.get('/api/export', wrap((req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks-export.json"');
  res.json(store.exportAll());
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`Bookmarks app running at http://localhost:${PORT}`));
}

module.exports = { app, store };
