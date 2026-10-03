// API routes for the Bookmark Manager. All handlers are thin wrappers over
// the services and translate errors to the shared error shape.
import express from 'express';
import multer from 'multer';
import * as bookmarks from '../services/bookmarks.js';
import * as tags from '../services/tags.js';
import * as savedSearches from '../services/savedSearches.js';
import * as metadata from '../services/metadata.js';
import * as netscape from '../services/netscape.js';
import * as preferences from '../services/preferences.js';
import { preserve } from '../services/preserve.js';
import { saveToInternetArchive } from '../services/archiveOrg.js';
import { SearchQueryError } from '../services/search.js';
import { DuplicateError } from '../services/bookmarks.js';
import { isValidHttpUrl } from '../services/normalize.js';
import db from '../db/index.js';
import fs from 'node:fs';

const router = express.Router();

function err(res, status, code, message, details) {
  return res.status(status).json({ error: { code, message, details } });
}

function arrify(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// ---- Metadata --------------------------------------------------------------

router.post('/metadata', async (req, res) => {
  const { url } = req.body || {};
  if (!isValidHttpUrl(url)) {
    return err(res, 422, 'INVALID_URL', 'Please enter a valid web address (http or https).');
  }
  const existing = bookmarks.findByUrl(url);
  if (existing) {
    return res.json({ existingId: existing.id });
  }
  const meta = await metadata.fetchMetadata(url);
  return res.json({ url, ...meta });
});

// ---- Bookmarks -------------------------------------------------------------

router.get('/bookmarks', (req, res) => {
  const prefs = preferences.get();
  try {
    const result = bookmarks.list({
      view: req.query.view || 'main',
      q: req.query.q || '',
      tags: arrify(req.query.tag),
      notTags: arrify(req.query.nottag),
      sort: req.query.sort || prefs.defaultSort,
      page: req.query.page || 1,
      pageSize: req.query.pageSize || prefs.itemsPerView,
    });
    return res.json(result);
  } catch (e) {
    if (e instanceof SearchQueryError) {
      return err(res, 400, 'MALFORMED_QUERY', e.message);
    }
    throw e;
  }
});

router.post('/bookmarks', async (req, res) => {
  try {
    const b = bookmarks.create(req.body || {});
    return res.status(201).json({ bookmark: b });
  } catch (e) {
    if (e instanceof DuplicateError) {
      return res
        .status(409)
        .json({ error: { code: 'DUPLICATE', message: 'Already bookmarked.' }, existingId: e.existingId });
    }
    if (e.code === 'INVALID_URL') {
      return err(res, 422, 'INVALID_URL', 'Please enter a valid web address.');
    }
    throw e;
  }
});

router.get('/bookmarks/:id', (req, res) => {
  const b = bookmarks.getById(Number(req.params.id));
  if (!b) return err(res, 404, 'NOT_FOUND', 'Bookmark not found.');
  return res.json({ bookmark: b });
});

router.patch('/bookmarks/:id', (req, res) => {
  try {
    const b = bookmarks.update(Number(req.params.id), req.body || {});
    if (!b) return err(res, 404, 'NOT_FOUND', 'Bookmark not found.');
    return res.json({ bookmark: b });
  } catch (e) {
    if (e instanceof DuplicateError) {
      return res
        .status(409)
        .json({ error: { code: 'DUPLICATE', message: 'Another bookmark already uses that address.' }, existingId: e.existingId });
    }
    if (e.code === 'INVALID_URL') {
      return err(res, 422, 'INVALID_URL', 'Please enter a valid web address.');
    }
    throw e;
  }
});

router.delete('/bookmarks/:id', (req, res) => {
  if (req.query.confirm !== 'true') {
    return err(res, 428, 'CONFIRM_REQUIRED', 'Deletion must be confirmed.');
  }
  const ok = bookmarks.remove(Number(req.params.id));
  if (!ok) return err(res, 404, 'NOT_FOUND', 'Bookmark not found.');
  return res.json({ deleted: true });
});

// ---- Bulk ------------------------------------------------------------------

router.post('/bookmarks/bulk', (req, res) => {
  const { ids, match, action, tags: actionTags, value, confirm } = req.body || {};
  if (action === 'delete' && confirm !== true) {
    return err(res, 428, 'CONFIRM_REQUIRED', 'Bulk deletion must be confirmed.');
  }
  const target = Array.isArray(ids) ? { ids } : { match };
  try {
    const result = bookmarks.bulk(target, { action, tags: actionTags, value });
    return res.json(result);
  } catch (e) {
    if (e instanceof SearchQueryError) {
      return err(res, 400, 'MALFORMED_QUERY', e.message);
    }
    throw e;
  }
});

// ---- Tags ------------------------------------------------------------------

router.get('/tags', (req, res) => {
  return res.json({ tags: tags.listWithCounts() });
});

// ---- Saved searches --------------------------------------------------------

router.get('/saved-searches', (req, res) => {
  return res.json({ items: savedSearches.list() });
});

router.post('/saved-searches', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return err(res, 422, 'INVALID', 'A name is required.');
  }
  try {
    return res.status(201).json({ savedSearch: savedSearches.create(req.body) });
  } catch (e) {
    return err(res, 409, 'DUPLICATE', 'A saved search with that name already exists.');
  }
});

router.patch('/saved-searches/:id', (req, res) => {
  const s = savedSearches.update(Number(req.params.id), req.body || {});
  if (!s) return err(res, 404, 'NOT_FOUND', 'Saved search not found.');
  return res.json({ savedSearch: s });
});

router.delete('/saved-searches/:id', (req, res) => {
  const ok = savedSearches.remove(Number(req.params.id));
  if (!ok) return err(res, 404, 'NOT_FOUND', 'Saved search not found.');
  return res.json({ deleted: true });
});

// ---- Preservation ----------------------------------------------------------

router.post('/bookmarks/:id/preserve', async (req, res) => {
  const id = Number(req.params.id);
  const b = bookmarks.getById(id);
  if (!b) return err(res, 404, 'NOT_FOUND', 'Bookmark not found.');
  try {
    const { kind, filePath } = await preserve(id, b.url);
    bookmarks.update(id, { preservedPath: filePath, preservedKind: kind });
    return res.json({ preservedKind: kind, preservedPath: filePath });
  } catch (e) {
    return err(res, 502, 'PRESERVE_FAILED', `Could not preserve the page. The bookmark was kept. (${e.message})`);
  }
});

router.get('/bookmarks/:id/preserved', (req, res) => {
  const b = bookmarks.getById(Number(req.params.id));
  if (!b || !b.preservedPath || !fs.existsSync(b.preservedPath)) {
    return err(res, 404, 'NOT_FOUND', 'No preserved copy available.');
  }
  res.type(b.preservedKind === 'pdf' ? 'application/pdf' : 'text/html');
  return res.send(fs.readFileSync(b.preservedPath));
});

// ---- Internet Archive ------------------------------------------------------

router.post('/bookmarks/:id/archive-org', async (req, res) => {
  const id = Number(req.params.id);
  const b = bookmarks.getById(id);
  if (!b) return err(res, 404, 'NOT_FOUND', 'Bookmark not found.');
  try {
    const archiveOrgUrl = await saveToInternetArchive(b.url);
    bookmarks.update(id, { archiveOrgUrl });
    return res.json({ archiveOrgUrl });
  } catch (e) {
    return err(res, 502, 'ARCHIVE_UNAVAILABLE', `Could not save to the Internet Archive right now. The bookmark was kept. (${e.message})`);
  }
});

// ---- Import / export -------------------------------------------------------

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/import', upload.single('file'), (req, res) => {
  let content = '';
  if (req.file) content = req.file.buffer.toString('utf8');
  else if (typeof req.body === 'string') content = req.body;
  else if (req.body && req.body.content) content = req.body.content;

  let parsed;
  try {
    parsed = netscape.parseNetscape(content);
  } catch (e) {
    return err(res, 422, 'INVALID_FILE', `That does not look like a bookmark file. Nothing was imported. (${e.message})`);
  }

  let imported = 0;
  let skippedDuplicates = 0;
  let defaultsApplied = 0;
  for (const item of parsed.bookmarks) {
    const existing = bookmarks.findByUrl(item.url);
    if (existing) {
      skippedDuplicates++;
      continue;
    }
    if (!item.title || !item.dateAdded) defaultsApplied++;
    const b = bookmarks.create({
      url: item.url,
      title: item.title || undefined,
      description: item.description || undefined,
      tags: item.tags || [],
    });
    if (item.dateAdded) {
      db.prepare('UPDATE bookmark SET date_added = ? WHERE id = ?').run(item.dateAdded, b.id);
    }
    imported++;
  }
  return res.json({ imported, skippedDuplicates, defaultsApplied });
});

router.get('/export', (req, res) => {
  const { items } = bookmarks.list({ view: 'main', page: 1, pageSize: Number.MAX_SAFE_INTEGER });
  const archived = bookmarks.list({ view: 'archive', page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items;
  const all = [...items, ...archived];
  const html = netscape.exportNetscape(all);
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.type('text/html');
  return res.send(html);
});

// ---- Preferences -----------------------------------------------------------

router.get('/preferences', (req, res) => {
  return res.json(preferences.get());
});

router.put('/preferences', (req, res) => {
  return res.json(preferences.set(req.body || {}));
});

export default router;
