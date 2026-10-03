// Bookmarks application server.
// Stores data and serves the frontend; search/sort/pagination happen in the
// browser over the full data set. Network-backed features (metadata, snapshot,
// Internet Archive) degrade gracefully when unavailable.
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Store } from './src/store.js';
import { fetchMetadata, captureSnapshot, sendToArchive } from './src/metadata.js';
import { exportNetscape, parseNetscape } from './src/netscape.js';
import { isValidUrl, normalizeUrl, domainOf, detectFileKindFromUrl } from './src/urls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, process.env.BOOKMARKS_DATA || 'data');
const store = new Store(path.join(DATA_DIR, 'db.json'));

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: ['text/html', 'text/plain'], limit: '20mb' }));

let seq = Date.now();
const newId = () => `${seq++}`;

function findDuplicate(url, exceptId) {
  const n = normalizeUrl(url);
  return store.all().find((b) => normalizeUrl(b.url) === n && String(b.id) !== String(exceptId));
}

// Background: attempt to capture a preserved copy and record the result.
function scheduleCapture(id, url) {
  captureSnapshot(url, id, DATA_DIR)
    .then((r) => store.update(id, { snapType: r.snapType, snapAt: r.snapAt, snapFile: r.snapFile || '' }))
    .catch(() => {});
}

// ---- state ----
app.get('/api/state', (req, res) => {
  res.json({ bookmarks: store.all(), savedSearches: store.savedSearches(), prefs: store.prefs() });
});

// ---- metadata lookup (auto-fill + duplicate check) ----
app.post('/api/metadata', async (req, res) => {
  const url = (req.body.url || '').trim();
  if (!isValidUrl(url)) return res.json({ valid: false });
  const dup = findDuplicate(url);
  if (dup) return res.json({ valid: true, duplicate: dup });
  const meta = await fetchMetadata(url);
  res.json({ valid: true, meta });
});

// ---- create ----
app.post('/api/bookmarks', (req, res) => {
  const body = req.body || {};
  const url = (body.url || '').trim();
  if (!isValidUrl(url)) return res.status(400).json({ error: 'invalid_url' });
  const dup = findDuplicate(url);
  if (dup) return res.status(409).json({ error: 'duplicate', existing: dup });
  const id = newId();
  const b = {
    id,
    url,
    title: (body.title || '').trim() || url,
    description: (body.description || '').trim(),
    note: (body.note || '').trim(),
    tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
    dom: domainOf(url),
    image: body.image || '',
    favicon: body.favicon || '',
    status: body.readLater === false ? 'done' : 'unread',
    archived: false,
    added: Date.now(),
    snapType: detectFileKindFromUrl(url),
    snapAt: null,
    snapFile: '',
    archiveUrl: '',
  };
  store.add(b);
  scheduleCapture(id, url); // automatic capture at save
  res.status(201).json(b);
});

// ---- update ----
app.patch('/api/bookmarks/:id', (req, res) => {
  const b = store.find(req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  const patch = req.body || {};
  if (patch.url && patch.url.trim() && normalizeUrl(patch.url) !== normalizeUrl(b.url)) {
    if (!isValidUrl(patch.url)) return res.status(400).json({ error: 'invalid_url' });
    const dup = findDuplicate(patch.url, b.id);
    if (dup) return res.status(409).json({ error: 'duplicate', existing: dup });
    patch.dom = domainOf(patch.url);
  }
  const allowed = {};
  for (const k of ['url', 'title', 'description', 'note', 'tags', 'status', 'archived', 'dom']) {
    if (k in patch) allowed[k] = patch[k];
  }
  if ('title' in allowed && !String(allowed.title).trim()) allowed.title = b.url;
  const updated = store.update(req.params.id, allowed);
  res.json(updated);
});

// ---- delete ----
app.delete('/api/bookmarks/:id', (req, res) => {
  store.remove(req.params.id);
  res.json({ ok: true });
});

// ---- bulk actions ----
app.post('/api/bookmarks/bulk', (req, res) => {
  const { ids = [], action, payload = {} } = req.body || {};
  const set = new Set(ids.map(String));
  const targets = store.all().filter((b) => set.has(String(b.id)));
  switch (action) {
    case 'addTags': {
      const add = (payload.tags || []).filter(Boolean);
      targets.forEach((b) => add.forEach((t) => {
        if (!(b.tags || []).some((x) => x.toLowerCase() === t.toLowerCase())) b.tags.push(t);
      }));
      break;
    }
    case 'removeTags': {
      const rem = (payload.tags || []).map((t) => t.toLowerCase());
      targets.forEach((b) => { b.tags = (b.tags || []).filter((t) => rem.indexOf(t.toLowerCase()) < 0); });
      break;
    }
    case 'mark':
      targets.forEach((b) => { b.status = payload.status === 'done' ? 'done' : 'unread'; });
      break;
    case 'archive':
      targets.forEach((b) => { b.archived = true; });
      break;
    case 'restore':
      targets.forEach((b) => { b.archived = false; });
      break;
    case 'delete':
      store.removeMany([...set]);
      return res.json({ ok: true, bookmarks: store.all() });
    default:
      return res.status(400).json({ error: 'unknown_action' });
  }
  store.persist();
  res.json({ ok: true, bookmarks: store.all() });
});

// ---- recapture preserved copy ----
app.post('/api/bookmarks/:id/recapture', async (req, res) => {
  const b = store.find(req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  const r = await captureSnapshot(b.url, b.id, DATA_DIR);
  const updated = store.update(b.id, { snapType: r.snapType, snapAt: r.snapAt, snapFile: r.snapFile || '' });
  res.json(updated);
});

// ---- send to Internet Archive (on demand) ----
app.post('/api/bookmarks/:id/archive-web', async (req, res) => {
  const b = store.find(req.params.id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  try {
    const archiveUrl = await sendToArchive(b.url);
    const updated = store.update(b.id, { archiveUrl });
    res.json(updated);
  } catch {
    res.status(502).json({ error: 'archive_unavailable' });
  }
});

// ---- open preserved copy ----
app.get('/snapshots/:id', (req, res) => {
  const b = store.find(req.params.id);
  if (!b || !b.snapAt || !b.snapFile) return res.status(404).send('No preserved copy available.');
  const full = path.join(DATA_DIR, b.snapFile);
  if (!fs.existsSync(full)) return res.status(404).send('Preserved copy file missing.');
  res.type(b.snapType === 'pdf' ? 'application/pdf' : 'text/html');
  fs.createReadStream(full).pipe(res);
});

// ---- export ----
app.get('/api/export', (req, res) => {
  res.type('text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(exportNetscape(store.all()));
});

// ---- import ----
app.post('/api/import', (req, res) => {
  const html = typeof req.body === 'string' ? req.body : '';
  const records = parseNetscape(html);
  let added = 0, skipped = 0;
  for (const r of records) {
    if (!isValidUrl(r.url) || findDuplicate(r.url)) { skipped++; continue; }
    const id = newId();
    const b = {
      id, url: r.url, title: r.title || r.url, description: r.description || '', note: '',
      tags: r.tags || [], dom: domainOf(r.url), image: '', favicon: '',
      status: 'done', // imports arrive as reference. Basis: SCN-023
      archived: false, added: r.added || Date.now(),
      snapType: detectFileKindFromUrl(r.url), snapAt: null, snapFile: '', archiveUrl: '',
    };
    store.all().push(b);
    added++;
  }
  store.persist();
  res.json({ added, skipped, bookmarks: store.all() });
});

// ---- saved searches ----
app.post('/api/searches', (req, res) => {
  const { name, query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'empty_query' });
  const s = { id: newId(), name: (name || query).trim(), query: query.trim() };
  store.addSavedSearch(s);
  res.status(201).json(s);
});
app.delete('/api/searches/:id', (req, res) => {
  store.removeSavedSearch(req.params.id);
  res.json({ ok: true });
});

// ---- preferences ----
app.put('/api/prefs', (req, res) => {
  res.json(store.setPrefs(req.body || {}));
});

// ---- static ----
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bookmarks app on http://0.0.0.0:${PORT}`));

export { app };
