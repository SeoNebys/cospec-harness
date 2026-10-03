import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SNAPSHOT_DIR } from './src/db.js';
import * as store from './src/store.js';
import { fetchMetadata } from './src/metadata.js';
import { capturePage } from './src/snapshot.js';
import { parseNetscape, toNetscape } from './src/netscape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '25mb' }));
app.use(express.text({ type: 'text/html', limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const asyncH = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  if (err.code === 'DUP_URL') {
    return res.status(409).json({ error: err.message, existing: err.existing });
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

// ---- Metadata preview (does not persist) ----------------------------------
app.post('/api/fetch-metadata', asyncH(async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  const meta = await fetchMetadata(url);
  res.json(meta);
}));

// ---- Bookmarks ------------------------------------------------------------
app.get('/api/bookmarks', asyncH((req, res) => {
  const { q = '', scope = 'active', sort = 'created_desc' } = req.query;
  const result = store.listBookmarks({ query: q, scope, sort });
  res.json({ ...result, counts: store.counts() });
}));

app.get('/api/bookmarks/:id', asyncH((req, res) => {
  const bm = store.getBookmark(Number(req.params.id));
  if (!bm) return res.status(404).json({ error: 'not found' });
  res.json({ ...bm, snapshots: store.listSnapshots(bm.id) });
}));

// Create. If autofetch !== false and metadata fields are blank, fill them in.
app.post('/api/bookmarks', asyncH(async (req, res) => {
  const data = req.body || {};
  if (!data.url) return res.status(400).json({ error: 'url is required' });

  const existing = store.findByUrl(data.url);
  if (existing) return res.status(200).json({ bookmark: existing, duplicate: true });

  const autofetch = data.autofetch !== false;
  if (autofetch) {
    const meta = await fetchMetadata(data.url);
    for (const key of ['title', 'description', 'favicon', 'preview_image']) {
      if (!data[key]) data[key] = meta[key] || '';
    }
  }
  const { bookmark, duplicate } = store.createBookmark(data);
  res.status(duplicate ? 200 : 201).json({ bookmark, duplicate });
}));

app.patch('/api/bookmarks/:id', asyncH((req, res) => {
  const bm = store.updateBookmark(Number(req.params.id), req.body || {});
  if (!bm) return res.status(404).json({ error: 'not found' });
  res.json(bm);
}));

app.delete('/api/bookmarks/:id', asyncH((req, res) => {
  const ok = store.deleteBookmark(Number(req.params.id));
  res.json({ deleted: ok });
}));

// Re-fetch metadata for an existing bookmark (optionally overwrite fields).
app.post('/api/bookmarks/:id/refetch', asyncH(async (req, res) => {
  const bm = store.getBookmark(Number(req.params.id));
  if (!bm) return res.status(404).json({ error: 'not found' });
  const meta = await fetchMetadata(bm.url);
  res.json(meta);
}));

app.post('/api/bulk', asyncH((req, res) => {
  const { ids, action, value } = req.body || {};
  res.json(store.bulkAction(ids, action, value));
}));

// ---- Tags -----------------------------------------------------------------
app.get('/api/tags', asyncH((_req, res) => res.json(store.listTags())));

// ---- Saved filters --------------------------------------------------------
app.get('/api/filters', asyncH((_req, res) => res.json(store.listSavedFilters())));
app.post('/api/filters', asyncH((req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(store.createSavedFilter(req.body));
}));
app.delete('/api/filters/:id', asyncH((req, res) => {
  res.json({ deleted: store.deleteSavedFilter(Number(req.params.id)) });
}));

// ---- Snapshots ------------------------------------------------------------
app.get('/api/bookmarks/:id/snapshots', asyncH((req, res) => {
  res.json(store.listSnapshots(Number(req.params.id)));
}));

app.post('/api/bookmarks/:id/snapshots', asyncH(async (req, res) => {
  const bm = store.getBookmark(Number(req.params.id));
  if (!bm) return res.status(404).json({ error: 'not found' });
  const captured = await capturePage(bm.url, bm.id);
  const snap = store.addSnapshot(bm.id, captured);
  res.status(201).json(snap);
}));

app.delete('/api/snapshots/:id', asyncH((req, res) => {
  const snap = store.deleteSnapshot(Number(req.params.id));
  if (snap) {
    for (const f of [snap.image_file, snap.html_file]) {
      if (f) fs.rm(path.join(SNAPSHOT_DIR, f), () => {});
    }
  }
  res.json({ deleted: !!snap });
}));

// Serve snapshot files (image inline, html as a page).
app.get('/snapshots/:file', (req, res) => {
  const file = path.basename(req.params.file);
  const full = path.join(SNAPSHOT_DIR, file);
  if (!fs.existsSync(full)) return res.status(404).send('Snapshot not found');
  res.sendFile(full);
});

// ---- Preferences ----------------------------------------------------------
app.get('/api/preferences', asyncH((_req, res) => res.json(store.getPreferences())));
app.patch('/api/preferences', asyncH((req, res) => res.json(store.setPreferences(req.body || {}))));

// ---- Import / export ------------------------------------------------------
app.get('/api/export.json', asyncH((_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.json"');
  res.json(store.exportAll());
}));

app.get('/api/export.html', asyncH((_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(toNetscape(store.exportAll()));
}));

app.post('/api/import', asyncH((req, res) => {
  const body = req.body;
  let items = [];
  if (typeof body === 'string') {
    items = parseNetscape(body); // text/html browser export
  } else if (body && Array.isArray(body.bookmarks)) {
    items = body.bookmarks; // our JSON export
    if (Array.isArray(body.saved_filters)) {
      for (const f of body.saved_filters) {
        if (f && f.name) store.createSavedFilter(f);
      }
    }
  } else if (Array.isArray(body)) {
    items = body;
  }
  res.json(store.importBookmarks(items));
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
