'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { normalise, keyOf, hostOf, guessTitle, isPdf, cleanTag, uniq } = require('./urlutil');
const { parseImport, toNetscape, toJson } = require('./importexport');
const { fetchMetadata, makeSnapshot, submitInternetArchive } = require('./pagefetch');

store.load();

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const data = store.data;
const findBookmark = id => data.bookmarks.find(b => String(b.id) === String(id));

// Trim heavy/internal fields for the client payload.
function publicBookmark(b) {
  return {
    id: b.id, url: b.url, host: b.host, title: b.title, description: b.description || '',
    note: b.note || '', tags: b.tags || [], created: b.created, updated: b.updated,
    toRead: !!b.toRead, archived: !!b.archived, previewImage: b.previewImage || '',
    favicon: b.favicon || '', copies: b.copies || { local: null, ia: null }
  };
}

app.get('/api/state', (req, res) => {
  res.json({
    bookmarks: data.bookmarks.map(publicBookmark),
    savedSearches: data.savedSearches,
    preferences: data.preferences
  });
});

// Metadata preview for the review-before-saving step (SCN-001). Also reports a
// duplicate so the client can jump to the existing bookmark (SCN-002).
app.post('/api/metadata', async (req, res) => {
  const u = normalise(req.body && req.body.url);
  if (!u) return res.status(400).json({ error: 'not-a-link' });
  const key = keyOf(u);
  const dup = data.bookmarks.find(b => b.key === key);
  if (dup) return res.json({ duplicate: publicBookmark(dup) });
  const meta = await fetchMetadata(u.href);
  res.json({
    url: u.href, host: hostOf(u), title: meta.title || guessTitle(u),
    description: meta.description || '', previewImage: meta.previewImage || '', favicon: meta.favicon || ''
  });
});

// Create a bookmark from reviewed fields; auto-make the in-app copy (SCN-018).
app.post('/api/bookmarks', async (req, res) => {
  const body = req.body || {};
  const u = normalise(body.url);
  if (!u) return res.status(400).json({ error: 'not-a-link' });
  const key = keyOf(u);
  const dup = data.bookmarks.find(b => b.key === key);
  if (dup) return res.status(409).json({ duplicate: publicBookmark(dup) });
  const now = Date.now();
  const b = {
    id: store.nextId(), url: u.href, host: hostOf(u), key,
    title: (body.title || '').trim() || guessTitle(u),
    description: (body.description || '').trim(),
    note: (body.note || '').trim(),
    tags: uniq((body.tags || []).map(cleanTag).filter(Boolean)),
    created: now, updated: now, toRead: !!body.toRead, archived: false,
    previewImage: body.previewImage || '', favicon: body.favicon || '',
    copies: { local: null, ia: null }
  };
  data.bookmarks.push(b);
  b.copies.local = await makeSnapshot(u.href, b.id);  // automatic in-app copy
  store.persist();
  res.status(201).json(publicBookmark(b));
});

app.put('/api/bookmarks/:id', (req, res) => {
  const b = findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  const body = req.body || {};
  if (body.url !== undefined) {
    const u = normalise(body.url);
    if (u) { b.url = u.href; b.host = hostOf(u); b.key = keyOf(u); }
  }
  if (body.title !== undefined) b.title = (body.title || '').trim() || guessTitle(new URL(b.url));
  if (body.description !== undefined) b.description = (body.description || '').trim();
  if (body.note !== undefined) b.note = (body.note || '').trim();
  if (body.tags !== undefined) b.tags = uniq((body.tags || []).map(cleanTag).filter(Boolean));
  if (body.toRead !== undefined) b.toRead = !!body.toRead;
  b.updated = Date.now();
  store.persist();
  res.json(publicBookmark(b));
});

app.post('/api/bookmarks/:id/status', (req, res) => {
  const b = findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  const body = req.body || {};
  if (body.toRead !== undefined) b.toRead = !!body.toRead;
  if (body.archived !== undefined) b.archived = !!body.archived;
  b.updated = Date.now();
  store.persist();
  res.json(publicBookmark(b));
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const i = data.bookmarks.findIndex(b => String(b.id) === String(req.params.id));
  if (i === -1) return res.status(404).json({ error: 'not-found' });
  data.bookmarks.splice(i, 1);
  store.persist();
  res.json({ ok: true });
});

// Bulk actions on selected ids (SCN-016).
app.post('/api/bulk', (req, res) => {
  const { ids, action, tag } = req.body || {};
  const set = new Set((ids || []).map(String));
  const targets = data.bookmarks.filter(b => set.has(String(b.id)));
  const t = cleanTag(tag || '');
  if (action === 'delete') {
    data.bookmarks = data.bookmarks.filter(b => !set.has(String(b.id)));
  } else {
    targets.forEach(b => {
      switch (action) {
        case 'addTag': if (t && !b.tags.includes(t)) b.tags.push(t); break;
        case 'removeTag': b.tags = b.tags.filter(x => x !== t); break;
        case 'markRead': b.toRead = false; break;
        case 'markUnread': b.toRead = true; break;
        case 'archive': b.archived = true; break;
        case 'restore': b.archived = false; break;
      }
      b.updated = Date.now();
    });
  }
  store.persist();
  res.json({ ok: true, count: targets.length });
});

// Make/refresh a copy (SCN-018). which = 'local' | 'ia'.
app.post('/api/bookmarks/:id/copy', async (req, res) => {
  const b = findBookmark(req.params.id);
  if (!b) return res.status(404).json({ error: 'not-found' });
  const which = (req.body && req.body.which) || 'local';
  b.copies = b.copies || { local: null, ia: null };
  if (which === 'ia') {
    const r = await submitInternetArchive(b.url);
    b.copies.ia = r.ok ? { url: r.url, when: r.when } : null;
    store.persist();
    return res.json({ ok: r.ok, copies: b.copies });
  }
  b.copies.local = await makeSnapshot(b.url, b.id);
  store.persist();
  res.json({ ok: b.copies.local.status === 'ok', copies: b.copies });
});

app.get('/snapshots/:file', (req, res) => {
  const file = path.basename(req.params.file);
  const full = path.join(store.SNAP_DIR, file);
  if (!fs.existsSync(full)) return res.status(404).send('No saved copy found.');
  res.type(file.endsWith('.pdf') ? 'application/pdf' : 'text/html');
  fs.createReadStream(full).pipe(res);
});

// Saved searches (SCN-017).
app.post('/api/saved', (req, res) => {
  const { name, query, view } = req.body || {};
  const s = { id: store.nextSavedId(), name: (name || query || '').trim(), query: (query || '').trim(), view: view || 'all' };
  data.savedSearches.push(s);
  store.persist();
  res.status(201).json(s);
});
app.delete('/api/saved/:id', (req, res) => {
  data.savedSearches = data.savedSearches.filter(s => String(s.id) !== String(req.params.id));
  store.persist();
  res.json({ ok: true });
});

// Preferences (SCN-020).
app.put('/api/preferences', (req, res) => {
  const p = req.body || {};
  if (p.defaultSort) data.preferences.defaultSort = p.defaultSort;
  if (p.pageSize !== undefined) data.preferences.pageSize = p.pageSize === 'all' ? 'all' : parseInt(p.pageSize, 10) || 25;
  if (p.textSize) data.preferences.textSize = p.textSize;
  store.persist();
  res.json(data.preferences);
});

// Import (SCN-019). preview (commit=false) or commit=true.
app.post('/api/import', (req, res) => {
  let records;
  try { records = parseImport((req.body && req.body.text) || ''); }
  catch (e) { return res.status(400).json({ error: 'unreadable' }); }
  const decorated = records.map(r => {
    const u = normalise(r.url);
    return { r, u, dup: u ? data.bookmarks.some(b => b.key === keyOf(u)) : false, bad: !u };
  });
  const found = records.length;
  const dupCount = decorated.filter(d => d.dup && !d.bad).length;
  const badCount = decorated.filter(d => d.bad).length;
  const newOnes = decorated.filter(d => !d.dup && !d.bad);
  if (!req.body.commit) {
    return res.json({
      found, new: newOnes.length, duplicates: dupCount, unreadable: badCount,
      sample: records.slice(0, 12).map(r => ({ title: r.title || r.url, created: r.created, tags: r.tags || [] }))
    });
  }
  let added = 0;
  const created = [];
  newOnes.forEach(({ r, u }) => {
    const now = Date.now();
    const b = {
      id: store.nextId(), url: u.href, host: hostOf(u), key: keyOf(u),
      title: r.title || guessTitle(u), description: r.description || '', note: r.note || '',
      tags: r.tags || [], created: r.created || now, updated: r.updated || r.created || now,
      toRead: !!r.toRead, archived: !!r.archived, previewImage: '', favicon: '',
      copies: { local: { status: 'pending', when: now }, ia: null }
    };
    data.bookmarks.push(b); created.push(b); added++;
  });
  store.persist();
  // Make in-app copies in the background so import stays responsive.
  created.forEach(b => { makeSnapshot(b.url, b.id).then(c => { b.copies.local = c; store.persist(); }).catch(() => {}); });
  res.json({ found, added, duplicates: dupCount, unreadable: badCount });
});

// Export (SCN-019).
app.get('/api/export', (req, res) => {
  const fmt = req.query.format === 'json' ? 'json' : 'html';
  if (fmt === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks-backup.json"');
    res.type('application/json').send(toJson(data.bookmarks));
  } else {
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
    res.type('text/html').send(toNetscape(data.bookmarks));
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
if (require.main === module) {
  app.listen(PORT, HOST, () => console.log('Bookmarks app on http://' + HOST + ':' + PORT));
}
module.exports = app;
