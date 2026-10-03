'use strict';

const path = require('path');
const express = require('express');
const { db, SNAP_DIR, DEFAULT_PREFS } = require('./src/db');
const { buildSearchClause } = require('./src/search');
const { fetchMetadata, domainOf } = require('./src/metadata');
const { toJSON, toNetscapeHTML, parseImport } = require('./src/transfer');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/snapshots', express.static(SNAP_DIR));

const now = () => Date.now();

const SORTS = {
  created_desc: 'b.created_at DESC',
  created_asc: 'b.created_at ASC',
  updated_desc: 'b.updated_at DESC',
  updated_asc: 'b.updated_at ASC',
  title_asc: 'b.title COLLATE NOCASE ASC',
  title_desc: 'b.title COLLATE NOCASE DESC',
  domain_asc: 'b.domain COLLATE NOCASE ASC, b.title COLLATE NOCASE ASC'
};

// ---- tag helpers ----------------------------------------------------------

const getTagId = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
const insTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
const linkTag = db.prepare(
  'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
);
const unlinkAll = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?');

function ensureTag(name) {
  const clean = String(name).trim();
  if (!clean) return null;
  const row = getTagId.get(clean);
  if (row) return row.id;
  return insTag.run(clean).lastInsertRowid;
}

function setTags(bookmarkId, tags) {
  unlinkAll.run(bookmarkId);
  const seen = new Set();
  for (const t of tags || []) {
    const name = String(t).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const id = ensureTag(name);
    if (id) linkTag.run(bookmarkId, id);
  }
}

const tagsForStmt = db.prepare(`
  SELECT t.name FROM tags t
  JOIN bookmark_tags bt ON bt.tag_id = t.id
  WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE`);

function tagsFor(id) {
  return tagsForStmt.all(id).map((r) => r.name);
}

const hasSnapStmt = db.prepare(
  'SELECT COUNT(*) c FROM snapshots WHERE bookmark_id = ?'
);

function hydrate(row) {
  if (!row) return row;
  return {
    ...row,
    read_later: !!row.read_later,
    archived: !!row.archived,
    tags: tagsFor(row.id),
    snapshot_count: hasSnapStmt.get(row.id).c
  };
}

// Clean up orphan tags (no bookmarks) to keep the tag list tidy.
function pruneTags() {
  db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)'
  ).run();
}

// ---- bookmarks: list ------------------------------------------------------

app.get('/api/bookmarks', (req, res) => {
  const view = req.query.view || 'all';
  const sort = SORTS[req.query.sort] ? req.query.sort : 'created_desc';
  const q = req.query.q || '';

  const where = [];
  const params = [];

  if (view === 'archived') where.push('b.archived = 1');
  else if (view === 'read_later') where.push('b.read_later = 1 AND b.archived = 0');
  else where.push('b.archived = 0'); // "all" = everything not archived

  const search = buildSearchClause(q);
  where.push(`(${search.sql})`);
  params.push(...search.params);

  const sql = `SELECT b.* FROM bookmarks b WHERE ${where.join(' AND ')}
               ORDER BY ${SORTS[sort]}`;
  let rows;
  try {
    rows = db.prepare(sql).all(...params);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid search query: ' + e.message });
  }
  res.json({ bookmarks: rows.map(hydrate), count: rows.length });
});

// ---- bookmarks: counts for sidebar ---------------------------------------

app.get('/api/stats', (_req, res) => {
  const all = db.prepare('SELECT COUNT(*) c FROM bookmarks WHERE archived = 0').get().c;
  const later = db
    .prepare('SELECT COUNT(*) c FROM bookmarks WHERE read_later = 1 AND archived = 0')
    .get().c;
  const archived = db
    .prepare('SELECT COUNT(*) c FROM bookmarks WHERE archived = 1')
    .get().c;
  const tags = db
    .prepare(
      `SELECT t.name, COUNT(bt.bookmark_id) c FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       JOIN bookmarks b ON b.id = bt.bookmark_id AND b.archived = 0
       GROUP BY t.id ORDER BY c DESC, t.name COLLATE NOCASE`
    )
    .all();
  res.json({ all, read_later: later, archived, tags });
});

// ---- bookmarks: single ----------------------------------------------------

const getById = db.prepare('SELECT * FROM bookmarks WHERE id = ?');
const getByUrl = db.prepare('SELECT * FROM bookmarks WHERE url = ?');

app.get('/api/bookmarks/:id', (req, res) => {
  const row = getById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(hydrate(row));
});

// ---- bookmarks: create ----------------------------------------------------

app.post('/api/bookmarks', (req, res) => {
  const b = req.body || {};
  let url = String(b.url || '').trim();
  if (!url) return res.status(400).json({ error: 'url is required' });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const existing = getByUrl.get(url);
  if (existing) {
    // Duplicate: signal the client to open the existing bookmark for editing.
    return res.status(200).json({ duplicate: true, bookmark: hydrate(existing) });
  }

  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO bookmarks
       (url, title, description, notes, icon, preview_image, domain,
        read_later, archived, created_at, updated_at)
       VALUES (@url,@title,@description,@notes,@icon,@preview_image,@domain,
               @read_later,@archived,@created_at,@updated_at)`
    )
    .run({
      url,
      title: b.title || '',
      description: b.description || '',
      notes: b.notes || '',
      icon: b.icon || '',
      preview_image: b.preview_image || '',
      domain: b.domain || domainOf(url),
      read_later: b.read_later ? 1 : 0,
      archived: 0,
      created_at: ts,
      updated_at: ts
    });
  const id = info.lastInsertRowid;
  setTags(id, b.tags || []);
  res.status(201).json({ duplicate: false, bookmark: hydrate(getById.get(id)) });
});

// ---- metadata fetch -------------------------------------------------------

app.post('/api/fetch-metadata', async (req, res) => {
  const url = String((req.body || {}).url || '').trim();
  if (!url) return res.status(400).json({ error: 'url is required' });
  const normalized = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  const existing = getByUrl.get(normalized);
  const meta = await fetchMetadata(url);
  res.json({ ...meta, existing: existing ? hydrate(existing) : null });
});

// ---- bookmarks: update ----------------------------------------------------

app.put('/api/bookmarks/:id', (req, res) => {
  const row = getById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};

  let url = b.url != null ? String(b.url).trim() : row.url;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (url !== row.url) {
    const clash = getByUrl.get(url);
    if (clash && clash.id !== row.id) {
      return res.status(409).json({ error: 'Another bookmark already uses that URL' });
    }
  }

  db.prepare(
    `UPDATE bookmarks SET
       url=@url, title=@title, description=@description, notes=@notes,
       icon=@icon, preview_image=@preview_image, domain=@domain,
       read_later=@read_later, archived=@archived, updated_at=@updated_at
     WHERE id=@id`
  ).run({
    id: row.id,
    url,
    title: b.title != null ? b.title : row.title,
    description: b.description != null ? b.description : row.description,
    notes: b.notes != null ? b.notes : row.notes,
    icon: b.icon != null ? b.icon : row.icon,
    preview_image: b.preview_image != null ? b.preview_image : row.preview_image,
    domain: domainOf(url),
    read_later: b.read_later != null ? (b.read_later ? 1 : 0) : row.read_later,
    archived: b.archived != null ? (b.archived ? 1 : 0) : row.archived,
    updated_at: now()
  });
  if (b.tags != null) setTags(row.id, b.tags);
  pruneTags();
  res.json(hydrate(getById.get(row.id)));
});

// ---- bookmarks: delete ----------------------------------------------------

app.delete('/api/bookmarks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  pruneTags();
  res.json({ deleted: info.changes });
});

// ---- bulk actions ---------------------------------------------------------

app.post('/api/bookmarks/bulk', (req, res) => {
  const { ids, action, value } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids required' });
  }
  const placeholders = ids.map(() => '?').join(',');
  const ts = now();
  const run = db.transaction(() => {
    switch (action) {
      case 'archive':
        db.prepare(
          `UPDATE bookmarks SET archived=1, updated_at=? WHERE id IN (${placeholders})`
        ).run(ts, ...ids);
        break;
      case 'unarchive':
        db.prepare(
          `UPDATE bookmarks SET archived=0, updated_at=? WHERE id IN (${placeholders})`
        ).run(ts, ...ids);
        break;
      case 'read_later':
        db.prepare(
          `UPDATE bookmarks SET read_later=1, updated_at=? WHERE id IN (${placeholders})`
        ).run(ts, ...ids);
        break;
      case 'clear_read_later':
        db.prepare(
          `UPDATE bookmarks SET read_later=0, updated_at=? WHERE id IN (${placeholders})`
        ).run(ts, ...ids);
        break;
      case 'delete':
        db.prepare(`DELETE FROM bookmarks WHERE id IN (${placeholders})`).run(...ids);
        break;
      case 'add_tags':
        for (const id of ids) {
          for (const t of value || []) {
            const tid = ensureTag(t);
            if (tid) linkTag.run(id, tid);
          }
          db.prepare('UPDATE bookmarks SET updated_at=? WHERE id=?').run(ts, id);
        }
        break;
      case 'remove_tag': {
        const tid = getTagId.get(String(value || ''));
        if (tid) {
          db.prepare(
            `DELETE FROM bookmark_tags WHERE tag_id=? AND bookmark_id IN (${placeholders})`
          ).run(tid.id, ...ids);
        }
        break;
      }
      default:
        throw new Error('unknown action');
    }
  });
  try {
    run();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  pruneTags();
  res.json({ ok: true, affected: ids.length });
});

// ---- snapshots ------------------------------------------------------------

const insSnap = db.prepare(
  `INSERT INTO snapshots (bookmark_id, title, image_file, html_file, created_at)
   VALUES (?, ?, ?, ?, ?)`
);

app.get('/api/bookmarks/:id/snapshots', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM snapshots WHERE bookmark_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json({ snapshots: rows });
});

app.post('/api/bookmarks/:id/snapshots', async (req, res) => {
  const row = getById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  try {
    const { capture } = require('./src/snapshot');
    const out = await capture(row.url, row.id);
    const info = insSnap.run(
      row.id,
      out.title || row.title,
      out.image_file,
      out.html_file,
      now()
    );
    res.status(201).json(db.prepare('SELECT * FROM snapshots WHERE id=?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ error: 'Snapshot failed: ' + e.message });
  }
});

app.delete('/api/snapshots/:id', (req, res) => {
  const fs = require('fs');
  const snap = db.prepare('SELECT * FROM snapshots WHERE id=?').get(req.params.id);
  if (snap) {
    for (const f of [snap.image_file, snap.html_file]) {
      if (f) try { fs.unlinkSync(path.join(SNAP_DIR, f)); } catch {}
    }
    db.prepare('DELETE FROM snapshots WHERE id=?').run(req.params.id);
  }
  res.json({ ok: true });
});

// ---- saved searches -------------------------------------------------------

app.get('/api/saved-searches', (_req, res) => {
  res.json({
    saved: db.prepare('SELECT * FROM saved_searches ORDER BY name COLLATE NOCASE').all()
  });
});

app.post('/api/saved-searches', (req, res) => {
  const { name, query, view, sort } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  const info = db
    .prepare(
      `INSERT INTO saved_searches (name, query, view, sort, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(String(name).trim(), query || '', view || 'all', sort || 'created_desc', now());
  res.status(201).json(
    db.prepare('SELECT * FROM saved_searches WHERE id=?').get(info.lastInsertRowid)
  );
});

app.delete('/api/saved-searches/:id', (req, res) => {
  db.prepare('DELETE FROM saved_searches WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---- preferences ----------------------------------------------------------

app.get('/api/preferences', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM preferences').all();
  const prefs = { ...DEFAULT_PREFS };
  for (const r of rows) prefs[r.key] = r.value;
  res.json(prefs);
});

app.put('/api/preferences', (req, res) => {
  const body = req.body || {};
  const up = db.prepare(
    'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  );
  for (const [k, v] of Object.entries(body)) up.run(k, String(v));
  const rows = db.prepare('SELECT key, value FROM preferences').all();
  const prefs = {};
  for (const r of rows) prefs[r.key] = r.value;
  res.json(prefs);
});

// ---- import / export ------------------------------------------------------

function allRowsWithTags() {
  const rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC').all();
  return rows.map((r) => ({ ...r, tags: tagsFor(r.id) }));
}

app.get('/api/export', (req, res) => {
  const format = req.query.format === 'html' ? 'html' : 'json';
  const rows = allRowsWithTags();
  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
    return res.send(toNetscapeHTML(rows));
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.json"');
  res.send(toJSON(rows));
});

app.post('/api/import', (req, res) => {
  const { data, format } = req.body || {};
  if (!data) return res.status(400).json({ error: 'data required' });
  let items;
  try {
    items = parseImport(data, format);
  } catch (e) {
    return res.status(400).json({ error: 'Could not parse import: ' + e.message });
  }
  let imported = 0, skipped = 0;
  const ts = now();
  const ins = db.prepare(
    `INSERT INTO bookmarks
     (url, title, description, notes, icon, preview_image, domain,
      read_later, archived, created_at, updated_at)
     VALUES (@url,@title,@description,@notes,@icon,@preview_image,@domain,
             @read_later,@archived,@created_at,@updated_at)`
  );
  const tx = db.transaction(() => {
    for (const it of items) {
      if (getByUrl.get(it.url)) { skipped++; continue; }
      const info = ins.run({
        url: it.url,
        title: it.title || '',
        description: it.description || '',
        notes: it.notes || '',
        icon: it.icon || '',
        preview_image: it.preview_image || '',
        domain: it.domain || domainOf(it.url),
        read_later: it.read_later ? 1 : 0,
        archived: it.archived ? 1 : 0,
        created_at: it.created_at || ts,
        updated_at: it.updated_at || ts
      });
      setTags(info.lastInsertRowid, it.tags || []);
      imported++;
    }
  });
  tx();
  res.json({ imported, skipped, total: items.length });
});

// ---- start ----------------------------------------------------------------

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});
