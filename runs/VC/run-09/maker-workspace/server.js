import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { DATA_DIR } from './db.js';
import { parseQuery } from './lib/search.js';
import { fetchMetadata, saveSnapshot } from './lib/metadata.js';
import { parseNetscape, exportNetscape } from './lib/netscape.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/* ------------------------------------------------------------------ helpers */

function normalizeUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return { url, key: url };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    let key = u.href;
    if (u.pathname !== '/' && key.endsWith('/')) key = key.slice(0, -1);
    return { url, key };
  } catch {
    return { url, key: url };
  }
}

const tagsOf = db.prepare(
  `SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
   WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE`
);

function getTags(id) {
  return tagsOf.all(id).map((r) => r.name);
}

const insTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
const findTag = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
const clearLinks = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?');
const linkTag = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
const unlinkTag = db.prepare(
  'DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)'
);

function setTags(id, names) {
  clearLinks.run(id);
  for (const name of dedupeTags(names)) {
    insTag.run(name);
    const tag = findTag.get(name);
    if (tag) linkTag.run(id, tag.id);
  }
}

function addTags(id, names) {
  for (const name of dedupeTags(names)) {
    insTag.run(name);
    const tag = findTag.get(name);
    if (tag) linkTag.run(id, tag.id);
  }
}

function dedupeTags(names) {
  const seen = new Map();
  for (const n of names || []) {
    const t = String(n).trim();
    if (t) seen.set(t.toLowerCase(), t);
  }
  return [...seen.values()];
}

// Delete orphan tags (no bookmarks left) to keep the tag list tidy.
function pruneTags() {
  db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)'
  ).run();
}

const delFts = db.prepare('DELETE FROM bookmarks_fts WHERE rowid = ?');
const insFts = db.prepare(
  'INSERT INTO bookmarks_fts (rowid, title, description, notes, url, tags) VALUES (?, ?, ?, ?, ?, ?)'
);

function reindex(id) {
  const b = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  delFts.run(id);
  if (!b) return;
  insFts.run(id, b.title, b.description, b.notes, b.url, getTags(id).join(' '));
}

function serialize(b) {
  return {
    ...b,
    favorite: !!b.favorite,
    read_later: !!b.read_later,
    archived: !!b.archived,
    tags: getTags(b.id),
    snapshot_url: b.snapshot_path ? '/' + b.snapshot_path.replace(/\\/g, '/') : '',
  };
}

const SORTS = {
  created_desc: 'b.created_at DESC, b.id DESC',
  created_asc: 'b.created_at ASC, b.id ASC',
  updated_desc: 'b.updated_at DESC, b.id DESC',
  updated_asc: 'b.updated_at ASC, b.id ASC',
  title_asc: 'b.title COLLATE NOCASE ASC, b.id DESC',
  title_desc: 'b.title COLLATE NOCASE DESC, b.id DESC',
};

/* -------------------------------------------------------------------- lists */

function listBookmarks({ q, scope, include, exclude, sort }) {
  const where = [];
  const params = [];

  switch (scope) {
    case 'read_later': where.push('b.read_later = 1 AND b.archived = 0'); break;
    case 'favorite': where.push('b.favorite = 1 AND b.archived = 0'); break;
    case 'archived': where.push('b.archived = 1'); break;
    case 'all': break;
    default: where.push('b.archived = 0'); // active
  }

  if (q && q.trim()) {
    const { positive, negative } = parseQuery(q);
    try {
      if (positive) {
        const ids = db
          .prepare('SELECT rowid FROM bookmarks_fts WHERE bookmarks_fts MATCH ?')
          .all(positive)
          .map((r) => r.rowid);
        if (!ids.length) return { bookmarks: [] };
        where.push(`b.id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
      if (negative) {
        const ids = db
          .prepare('SELECT rowid FROM bookmarks_fts WHERE bookmarks_fts MATCH ?')
          .all(negative)
          .map((r) => r.rowid);
        if (ids.length) {
          where.push(`b.id NOT IN (${ids.map(() => '?').join(',')})`);
          params.push(...ids);
        }
      }
    } catch (err) {
      return { bookmarks: [], error: 'Invalid search: ' + err.message };
    }
  }

  const inc = dedupeTags(include);
  if (inc.length) {
    where.push(
      `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
        WHERE t.name IN (${inc.map(() => '?').join(',')}) COLLATE NOCASE
        GROUP BY bt.bookmark_id HAVING COUNT(DISTINCT t.name) = ?)`
    );
    params.push(...inc, inc.length);
  }

  const exc = dedupeTags(exclude);
  if (exc.length) {
    where.push(
      `b.id NOT IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
        WHERE t.name IN (${exc.map(() => '?').join(',')}) COLLATE NOCASE)`
    );
    params.push(...exc);
  }

  const orderBy = SORTS[sort] || SORTS.created_desc;
  const sql =
    'SELECT b.* FROM bookmarks b' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY ' + orderBy;
  const rows = db.prepare(sql).all(...params);
  return { bookmarks: rows.map(serialize) };
}

/* ------------------------------------------------------------------- routes */

app.get('/api/bookmarks', (req, res) => {
  const include = [].concat(req.query.include || []);
  const exclude = [].concat(req.query.exclude || []);
  res.json(
    listBookmarks({
      q: req.query.q || '',
      scope: req.query.scope || 'active',
      include,
      exclude,
      sort: req.query.sort || 'created_desc',
    })
  );
});

app.get('/api/bookmarks/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json(serialize(b));
});

app.post('/api/bookmarks', async (req, res) => {
  const body = req.body || {};
  const { url, key } = normalizeUrl(body.url);
  if (!key) return res.status(400).json({ error: 'A URL is required' });

  const existing = db.prepare('SELECT * FROM bookmarks WHERE url_key = ?').get(key);
  if (existing) {
    // Duplicate: hand back the existing bookmark so the UI can open it to edit.
    return res.json({ duplicate: true, bookmark: serialize(existing) });
  }

  let meta = { title: '', description: '', favicon: '', preview_image: '', html: '', finalUrl: url, ok: false, error: '' };
  const autofetch = body.autofetch !== false;
  if (autofetch) meta = await fetchMetadata(url);

  const info = db
    .prepare(
      `INSERT INTO bookmarks (url, url_key, title, description, notes, favicon, preview_image, favorite, read_later)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      url,
      key,
      (body.title || meta.title || '').trim(),
      (body.description || meta.description || '').trim(),
      (body.notes || '').trim(),
      (body.favicon || meta.favicon || '').trim(),
      (body.preview_image || meta.preview_image || '').trim(),
      body.favorite ? 1 : 0,
      body.read_later ? 1 : 0
    );
  const id = info.lastInsertRowid;
  setTags(id, body.tags || []);

  if (body.snapshot && meta.html) {
    try {
      const rel = await saveSnapshot(id, meta.html, meta.finalUrl);
      db.prepare('UPDATE bookmarks SET snapshot_path = ? WHERE id = ?').run(rel, id);
    } catch { /* best-effort */ }
  }

  reindex(id);
  const b = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  res.json({ duplicate: false, bookmark: serialize(b), fetch_error: meta.error });
});

app.patch('/api/bookmarks/:id', (req, res) => {
  const id = req.params.id;
  const b = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const body = req.body || {};

  const fields = [];
  const params = [];
  const setIf = (col, val, transform = (v) => v) => {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      params.push(transform(val));
    }
  };

  if (body.url !== undefined) {
    const { url, key } = normalizeUrl(body.url);
    const clash = db.prepare('SELECT id FROM bookmarks WHERE url_key = ? AND id != ?').get(key, id);
    if (clash) return res.status(409).json({ error: 'Another bookmark already uses that URL', existingId: clash.id });
    fields.push('url = ?', 'url_key = ?');
    params.push(url, key);
  }
  setIf('title', body.title, (v) => String(v).trim());
  setIf('description', body.description, (v) => String(v).trim());
  setIf('notes', body.notes, (v) => String(v).trim());
  setIf('favicon', body.favicon, (v) => String(v).trim());
  setIf('preview_image', body.preview_image, (v) => String(v).trim());
  setIf('favorite', body.favorite, (v) => (v ? 1 : 0));
  setIf('read_later', body.read_later, (v) => (v ? 1 : 0));
  setIf('archived', body.archived, (v) => (v ? 1 : 0));

  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  if (body.tags !== undefined) {
    setTags(id, body.tags);
    pruneTags();
  }
  reindex(id);
  res.json(serialize(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id)));
});

app.delete('/api/bookmarks/:id', (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  delFts.run(req.params.id);
  pruneTags();
  res.json({ ok: true });
});

app.post('/api/bookmarks/bulk', (req, res) => {
  const { ids, action, value, tags } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No bookmarks selected' });
  const valid = ids.filter((i) => Number.isInteger(i));
  const run = db.transaction(() => {
    switch (action) {
      case 'favorite':
      case 'read_later':
      case 'archived': {
        const stmt = db.prepare(`UPDATE bookmarks SET ${action} = ?, updated_at = datetime('now') WHERE id = ?`);
        for (const id of valid) stmt.run(value ? 1 : 0, id);
        break;
      }
      case 'delete': {
        const stmt = db.prepare('DELETE FROM bookmarks WHERE id = ?');
        for (const id of valid) { stmt.run(id); delFts.run(id); }
        break;
      }
      case 'add_tags':
        for (const id of valid) { addTags(id, tags); reindex(id); }
        break;
      case 'remove_tags':
        for (const id of valid) {
          for (const t of dedupeTags(tags)) unlinkTag.run(id, t);
          reindex(id);
        }
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
  });
  try {
    run();
    pruneTags();
    res.json({ ok: true, count: valid.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Metadata-only peek for a URL not yet saved (used by the add form).
app.get('/api/peek', async (req, res) => {
  const { url } = normalizeUrl(req.query.url || '');
  if (!url) return res.status(400).json({ error: 'A URL is required' });
  const meta = await fetchMetadata(url);
  res.json({
    ok: meta.ok,
    error: meta.error,
    title: meta.title,
    description: meta.description,
    favicon: meta.favicon,
    preview_image: meta.preview_image,
  });
});

// Re-fetch metadata suggestions (does not overwrite; the UI decides).
app.post('/api/bookmarks/:id/metadata', async (req, res) => {
  const b = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const meta = await fetchMetadata(b.url);
  res.json({
    ok: meta.ok,
    error: meta.error,
    title: meta.title,
    description: meta.description,
    favicon: meta.favicon,
    preview_image: meta.preview_image,
  });
});

// Create / refresh the local snapshot.
app.post('/api/bookmarks/:id/snapshot', async (req, res) => {
  const b = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const meta = await fetchMetadata(b.url);
  if (!meta.html) return res.status(502).json({ error: meta.error || 'Could not retrieve page content' });
  try {
    const rel = await saveSnapshot(b.id, meta.html, meta.finalUrl);
    db.prepare('UPDATE bookmarks SET snapshot_path = ?, updated_at = datetime(\'now\') WHERE id = ?').run(rel, b.id);
    res.json({ ok: true, snapshot_url: '/' + rel.replace(/\\/g, '/') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------------------------- tags */

app.get('/api/tags', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT t.name,
              COUNT(bt.bookmark_id) AS count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       LEFT JOIN bookmarks b ON b.id = bt.bookmark_id AND b.archived = 0
       GROUP BY t.id HAVING count > 0
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
  res.json(rows);
});

/* -------------------------------------------------------------- saved views */

app.get('/api/views', (_req, res) => {
  const rows = db.prepare('SELECT * FROM saved_views ORDER BY name COLLATE NOCASE').all();
  res.json(rows.map(deserializeView));
});

function deserializeView(v) {
  return {
    ...v,
    include_tags: JSON.parse(v.include_tags || '[]'),
    exclude_tags: JSON.parse(v.exclude_tags || '[]'),
  };
}

app.post('/api/views', (req, res) => {
  const v = req.body || {};
  if (!v.name || !v.name.trim()) return res.status(400).json({ error: 'A name is required' });
  const info = db
    .prepare(
      `INSERT INTO saved_views (name, query, include_tags, exclude_tags, scope, sort)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      v.name.trim(),
      v.query || '',
      JSON.stringify(dedupeTags(v.include_tags)),
      JSON.stringify(dedupeTags(v.exclude_tags)),
      v.scope || 'active',
      v.sort || 'created_desc'
    );
  res.json(deserializeView(db.prepare('SELECT * FROM saved_views WHERE id = ?').get(info.lastInsertRowid)));
});

app.patch('/api/views/:id', (req, res) => {
  const v = req.body || {};
  const existing = db.prepare('SELECT * FROM saved_views WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    `UPDATE saved_views SET name = ?, query = ?, include_tags = ?, exclude_tags = ?, scope = ?, sort = ? WHERE id = ?`
  ).run(
    (v.name ?? existing.name).trim(),
    v.query ?? existing.query,
    JSON.stringify(dedupeTags(v.include_tags ?? JSON.parse(existing.include_tags))),
    JSON.stringify(dedupeTags(v.exclude_tags ?? JSON.parse(existing.exclude_tags))),
    v.scope ?? existing.scope,
    v.sort ?? existing.sort,
    req.params.id
  );
  res.json(deserializeView(db.prepare('SELECT * FROM saved_views WHERE id = ?').get(req.params.id)));
});

app.delete('/api/views/:id', (req, res) => {
  db.prepare('DELETE FROM saved_views WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ----------------------------------------------------------- import/export */

app.get('/api/export', (_req, res) => {
  const rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at').all();
  const withTags = rows.map((b) => ({ ...b, tags: getTags(b.id) }));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(exportNetscape(withTags));
});

app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const html = req.file.buffer.toString('utf8');
  const items = parseNetscape(html);
  let imported = 0;
  let skipped = 0;
  const run = db.transaction(() => {
    for (const item of items) {
      const { url, key } = normalizeUrl(item.url);
      if (!key) { skipped++; continue; }
      const existing = db.prepare('SELECT id FROM bookmarks WHERE url_key = ?').get(key);
      if (existing) {
        // Merge any new tags into the existing bookmark rather than duplicating.
        if (item.tags.length) { addTags(existing.id, item.tags); reindex(existing.id); }
        skipped++;
        continue;
      }
      const cols = ['url', 'url_key', 'title', 'description'];
      const vals = [url, key, item.title || '', item.description || ''];
      if (item.created_at) { cols.push('created_at'); vals.push(item.created_at); }
      const info = db
        .prepare(`INSERT INTO bookmarks (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
        .run(...vals);
      setTags(info.lastInsertRowid, item.tags);
      reindex(info.lastInsertRowid);
      imported++;
    }
  });
  run();
  res.json({ ok: true, imported, skipped, total: items.length });
});

/* ------------------------------------------------------------------- static */

app.use('/snapshots', express.static(join(DATA_DIR, 'snapshots')));
app.use(express.static(join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});

// Close the database explicitly on shutdown so better-sqlite3 finalizes its
// prepared statements while the V8 environment is still alive; otherwise the
// native destructors run during teardown and abort with an assertion.
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    try { db.close(); } catch { /* ignore */ }
    process.exit(0);
  });
  // Fallback in case connections keep the server open.
  setTimeout(() => { try { db.close(); } catch {} process.exit(0); }, 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
