'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const { db, SNAP_DIR } = require('./src/db');
const model = require('./src/model');
const { fetchMetadata } = require('./src/metadata');
const { saveToInternetArchive } = require('./src/archive');
const { parseNetscape, buildNetscape } = require('./src/netscape');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.text({ type: ['text/html', 'text/plain'], limit: '20mb' }));

const PORT = process.env.PORT || 4000;

function wrap(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });
}

// ---- preferences ---------------------------------------------------------
function getPrefs() {
  const rows = db.prepare('SELECT key, value FROM preferences').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
app.get('/api/preferences', (req, res) => res.json(getPrefs()));
app.put('/api/preferences', (req, res) => {
  const allowed = ['default_sort', 'page_size', 'text_size', 'default_view'];
  const stmt = db.prepare('INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const k of allowed) {
    if (k in (req.body || {})) stmt.run(k, String(req.body[k]));
  }
  res.json(getPrefs());
});

// ---- bookmarks list ------------------------------------------------------
app.get('/api/bookmarks', (req, res) => {
  const view = req.query.view || 'all';
  const query = req.query.query || '';
  const sort = req.query.sort || 'created_desc';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let pageSize = parseInt(req.query.pageSize, 10);
  if (isNaN(pageSize)) pageSize = 25;
  const limit = pageSize <= 0 ? -1 : pageSize;
  const offset = limit < 0 ? 0 : (page - 1) * limit;
  const { items, total } = model.listBookmarks({ view, query, sort, limit, offset });
  res.json({ items, total, page, pageSize, counts: viewCounts() });
});

function viewCounts() {
  const c = (where, params = []) => db.prepare(`SELECT COUNT(*) AS n FROM bookmarks b WHERE ${where}`).get(...params).n;
  return {
    all: c('b.archived = 0'),
    unread: c('b.archived = 0 AND b.unread = 1'),
    favorites: c('b.archived = 0 AND b.favorite = 1'),
    archived: c('b.archived = 1')
  };
}

app.get('/api/tags', (req, res) => res.json(model.tagFacets()));

// ---- single bookmark -----------------------------------------------------
app.get('/api/bookmarks/:id', (req, res) => {
  const b = model.getBookmark(Number(req.params.id));
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json(b);
});

app.post('/api/bookmarks', (req, res) => {
  const body = req.body || {};
  const url = String(body.url || '').trim();
  if (!url) return res.status(400).json({ error: 'URL is required' });
  // Duplicate detection: return the existing bookmark so the client can edit it.
  const existing = model.findByUrl(url);
  if (existing) return res.status(200).json({ duplicate: true, bookmark: existing });
  const created = model.createBookmark(body);
  res.status(201).json({ duplicate: false, bookmark: created });
});

app.put('/api/bookmarks/:id', (req, res) => {
  const updated = model.updateBookmark(Number(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Not found' });
  model.pruneOrphanTags();
  res.json(updated);
});

app.delete('/api/bookmarks/:id', (req, res) => {
  model.deleteBookmark(Number(req.params.id));
  model.pruneOrphanTags();
  res.json({ ok: true });
});

// ---- bulk actions --------------------------------------------------------
// Accepts either an explicit `ids` array, or `all: true` with `view`/`query`
// to act on everything matching the current filter.
app.post('/api/bookmarks/bulk', (req, res) => {
  const body = req.body || {};
  let ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
  if (body.all) ids = model.matchingIds({ view: body.view || 'all', query: body.query || '' });
  const action = body.action;
  const apply = db.transaction((idList) => {
    for (const id of idList) {
      switch (action) {
        case 'archive': model.updateBookmark(id, { archived: true }); break;
        case 'unarchive': model.updateBookmark(id, { archived: false }); break;
        case 'read': model.updateBookmark(id, { unread: false }); break;
        case 'unread': model.updateBookmark(id, { unread: true }); break;
        case 'favorite': model.updateBookmark(id, { favorite: true }); break;
        case 'unfavorite': model.updateBookmark(id, { favorite: false }); break;
        case 'delete': model.deleteBookmark(id); break;
        case 'addTag': if (body.tag) model.addTag(id, body.tag); break;
        case 'removeTag': if (body.tag) model.removeTag(id, body.tag); break;
        default: throw new Error('Unknown action: ' + action);
      }
    }
  });
  apply(ids);
  model.pruneOrphanTags();
  res.json({ ok: true, affected: ids.length });
});

// ---- metadata fetch ------------------------------------------------------
app.post('/api/fetch-metadata', wrap(async (req, res) => {
  const url = String((req.body || {}).url || '').trim();
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const meta = await fetchMetadata(url);
  res.json(meta);
}));

// ---- local snapshot ------------------------------------------------------
app.post('/api/bookmarks/:id/snapshot', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const b = model.getBookmark(id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  try {
    const { captureSnapshot } = require('./src/snapshot');
    const out = await captureSnapshot(id, b.url);
    const updated = model.updateBookmark(id, {
      snapshot_html: out.html || '',
      snapshot_pdf: out.pdf || '',
      snapshot_at: new Date().toISOString()
    });
    res.json({ ok: true, bookmark: updated });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Snapshot failed: ' + (err.message || err) });
  }
}));

app.get('/api/bookmarks/:id/snapshot/:kind', (req, res) => {
  const id = Number(req.params.id);
  const b = model.getBookmark(id);
  if (!b) return res.status(404).send('Not found');
  const file = req.params.kind === 'pdf' ? b.snapshot_pdf : b.snapshot_html;
  if (!file) return res.status(404).send('No snapshot');
  const full = path.join(SNAP_DIR, String(id), file);
  if (!fs.existsSync(full)) return res.status(404).send('Missing');
  res.sendFile(full);
});

// ---- Internet Archive ----------------------------------------------------
app.post('/api/bookmarks/:id/archive-org', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const b = model.getBookmark(id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const result = await saveToInternetArchive(b.url);
  if (!result.ok) return res.status(502).json({ ok: false, error: result.error });
  const updated = model.updateBookmark(id, { archive_url: result.archiveUrl });
  res.json({ ok: true, bookmark: updated });
}));

// ---- saved searches ------------------------------------------------------
app.get('/api/saved-searches', (req, res) => {
  res.json(db.prepare('SELECT * FROM saved_searches ORDER BY name COLLATE NOCASE').all());
});
app.post('/api/saved-searches', (req, res) => {
  const { name, query = '', view = 'all', sort = 'created_desc' } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  const info = db.prepare('INSERT INTO saved_searches (name, query, view, sort) VALUES (?, ?, ?, ?)')
    .run(String(name).trim(), query, view, sort);
  res.status(201).json(db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/saved-searches/:id', (req, res) => {
  db.prepare('DELETE FROM saved_searches WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- import / export -----------------------------------------------------
app.post('/api/import', (req, res) => {
  const html = typeof req.body === 'string' ? req.body : (req.body && req.body.html) || '';
  const items = parseNetscape(html);
  let imported = 0;
  let skipped = 0;
  const run = db.transaction(() => {
    for (const it of items) {
      if (model.findByUrl(it.url)) { skipped++; continue; }
      model.createBookmark(it);
      imported++;
    }
  });
  run();
  res.json({ ok: true, imported, skipped, total: items.length });
});

app.get('/api/export', (req, res) => {
  const { items } = model.listBookmarks({ view: 'all', query: '', sort: 'created_desc', limit: -1 });
  const archived = model.listBookmarks({ view: 'archived', query: '', sort: 'created_desc', limit: -1 }).items;
  const html = buildNetscape([...items, ...archived]);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(html);
});

// ---- static frontend -----------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
