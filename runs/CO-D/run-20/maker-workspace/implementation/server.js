// My Bookmarks — application server (single-user, no sign-in).
// Serves the web app and a small REST API backed by durable JSON storage.

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { Store } from './src/store.js';
import { isValidUrl, dedupKey, hostOf, normalizeUrl } from './src/urls.js';
import { normalizeTag, addTag as addTagTo, removeTag as removeTagFrom } from './src/tags.js';
import { fetchMeta, colorFor } from './src/metadata.js';
import { capture, removeCapture } from './src/offline.js';
import { submit as archiveSubmit } from './src/archive.js';
import { toNetscapeHtml, parseNetscapeHtml } from './src/importexport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PORT = process.env.PORT || 4000;

const store = new Store(DATA_DIR);
const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.text({ type: ['text/html', 'text/plain'], limit: '16mb' }));

const now = () => Date.now();
function touch(b) { b.updatedAt = now(); }

// ---- read whole state -------------------------------------------------------
app.get('/api/state', (req, res) => {
  res.json({ bookmarks: store.bookmarks, savedSearches: store.savedSearches, prefs: store.prefs });
});

// ---- metadata fetch for the save review step --------------------------------
app.post('/api/fetch-meta', async (req, res) => {
  const url = (req.body && req.body.url) || '';
  if (!isValidUrl(url)) return res.status(400).json({ error: 'not-a-web-address' });
  const meta = await fetchMeta(url);
  res.json(meta);
});

// ---- create -----------------------------------------------------------------
app.post('/api/bookmarks', (req, res) => {
  const body = req.body || {};
  if (!isValidUrl(body.url)) return res.status(400).json({ error: 'not-a-web-address' });
  const key = dedupKey(body.url);
  const existing = store.bookmarks.find((b) => dedupKey(b.url) === key);
  if (existing) return res.status(409).json({ error: 'duplicate', id: existing.id });

  const host = hostOf(body.url);
  const tags = Array.from(new Set((body.tags || []).map(normalizeTag).filter(Boolean)));
  const t = now();
  const bm = {
    id: store.nextId(),
    url: normalizeUrl(body.url),
    title: (body.title && String(body.title).trim()) || normalizeUrl(body.url),
    description: body.description ? String(body.description) : '',
    host,
    iconLetter: (host[0] || '?').toUpperCase(),
    color: body.color || colorFor(host),
    image: body.image || '',
    toRead: !!body.toRead,
    archived: false,
    tags,
    notes: body.notes ? String(body.notes) : '',
    createdAt: t,
    updatedAt: t,
    offline: null,
    archiveUrl: null,
  };
  store.bookmarks.unshift(bm);
  store.save();
  res.status(201).json(bm);
});

// ---- edit -------------------------------------------------------------------
app.patch('/api/bookmarks/:id', (req, res) => {
  const b = store.findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  const body = req.body || {};
  if ('title' in body) b.title = String(body.title).trim() || b.title;
  if ('description' in body) b.description = String(body.description);
  if ('notes' in body) b.notes = String(body.notes);
  if ('toRead' in body) b.toRead = !!body.toRead;
  if ('archived' in body) b.archived = !!body.archived;
  if ('tags' in body) b.tags = Array.from(new Set((body.tags || []).map(normalizeTag).filter(Boolean)));
  if ('url' in body && body.url) {
    if (!isValidUrl(body.url)) return res.status(400).json({ error: 'not-a-web-address' });
    b.url = normalizeUrl(body.url);
    b.host = hostOf(b.url);
    b.iconLetter = (b.host[0] || '?').toUpperCase();
    b.color = colorFor(b.host);
  }
  touch(b);
  store.save();
  res.json(b);
});

// ---- delete -----------------------------------------------------------------
app.delete('/api/bookmarks/:id', (req, res) => {
  const b = store.findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  removeCapture(b, store.offlineDir);
  store.data.bookmarks = store.bookmarks.filter((x) => x.id !== b.id);
  store.save();
  res.json({ ok: true });
});

// ---- offline copy -----------------------------------------------------------
app.post('/api/bookmarks/:id/offline', async (req, res) => {
  const b = store.findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  try {
    if (b.offline) removeCapture(b, store.offlineDir);
    b.offline = await capture(b, store.offlineDir);
    store.save();
    res.json(b);
  } catch (e) {
    res.status(502).json({ error: 'capture-failed', message: String(e.message || e) });
  }
});

app.delete('/api/bookmarks/:id/offline', (req, res) => {
  const b = store.findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  removeCapture(b, store.offlineDir);
  b.offline = null;
  store.save();
  res.json(b);
});

app.get('/api/offline/:id', (req, res) => {
  const b = store.findBookmark(req.params.id);
  if (!b || !b.offline) return res.status(404).send('No offline copy.');
  const file = path.join(store.offlineDir, b.offline.file);
  if (!fs.existsSync(file)) return res.status(404).send('Offline copy missing.');
  res.type(b.offline.contentType || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

// ---- Internet Archive (manual) ---------------------------------------------
app.post('/api/bookmarks/:id/archive', async (req, res) => {
  const b = store.findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  const result = await archiveSubmit(b.url);
  b.archiveUrl = result.snapshotUrl;
  store.save();
  res.json({ bookmark: b, submitted: result.submitted });
});

// ---- bulk actions -----------------------------------------------------------
app.post('/api/bulk', (req, res) => {
  const { ids = [], action, value } = req.body || {};
  const set = new Set(ids);
  const targets = store.bookmarks.filter((b) => set.has(b.id));
  if (action === 'delete') {
    for (const b of targets) removeCapture(b, store.offlineDir);
    store.data.bookmarks = store.bookmarks.filter((b) => !set.has(b.id));
  } else {
    for (const b of targets) {
      if (action === 'addTag') b.tags = addTagTo(b.tags, value);
      else if (action === 'removeTag') b.tags = removeTagFrom(b.tags, value);
      else if (action === 'toRead') b.toRead = !!value;
      else if (action === 'archived') b.archived = !!value;
      else return res.status(400).json({ error: 'unknown-action' });
      touch(b);
    }
  }
  store.save();
  res.json({ ok: true, count: targets.length });
});

// ---- saved searches (unique names) -----------------------------------------
app.post('/api/saved-searches', (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  const query = String((req.body && req.body.query) || '').trim();
  if (!name || !query) return res.status(400).json({ error: 'name-and-query-required' });
  if (store.savedSearches.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: 'duplicate-name' });
  }
  const s = { id: store.nextId(), name, query };
  store.savedSearches.push(s);
  store.save();
  res.status(201).json(s);
});

app.delete('/api/saved-searches/:id', (req, res) => {
  store.data.savedSearches = store.savedSearches.filter((s) => s.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

// ---- preferences ------------------------------------------------------------
app.put('/api/prefs', (req, res) => {
  const p = req.body || {};
  if ('defaultSort' in p) store.prefs.defaultSort = String(p.defaultSort);
  if ('pageSize' in p) store.prefs.pageSize = p.pageSize === 'all' ? 'all' : parseInt(p.pageSize, 10) || 25;
  if ('textSize' in p) store.prefs.textSize = String(p.textSize);
  store.save();
  res.json(store.prefs);
});

// ---- import / export --------------------------------------------------------
app.get('/api/export', (req, res) => {
  res.type('text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(toNetscapeHtml(store.bookmarks));
});

app.post('/api/import', (req, res) => {
  const html = typeof req.body === 'string' ? req.body : (req.body && req.body.html) || '';
  const records = parseNetscapeHtml(html);
  let added = 0, skipped = 0;
  for (const r of records) {
    if (!isValidUrl(r.url)) { continue; }
    const key = dedupKey(r.url);
    if (store.bookmarks.some((b) => dedupKey(b.url) === key)) { skipped++; continue; }
    const host = hostOf(r.url);
    const t = r.addDate || now();
    store.bookmarks.push({
      id: store.nextId(),
      url: normalizeUrl(r.url),
      title: r.title || normalizeUrl(r.url),
      description: '',
      host,
      iconLetter: (host[0] || '?').toUpperCase(),
      color: colorFor(host),
      image: '',
      toRead: false,
      archived: false,
      tags: r.tags || [],
      notes: '',
      createdAt: t,
      updatedAt: t,
      offline: null,
      archiveUrl: null,
    });
    added++;
  }
  store.save();
  res.json({ added, skipped, found: records.length });
});

// ---- static app -------------------------------------------------------------
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));

export function createServer() { return app; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`My Bookmarks listening on http://0.0.0.0:${PORT}`);
  });
}
