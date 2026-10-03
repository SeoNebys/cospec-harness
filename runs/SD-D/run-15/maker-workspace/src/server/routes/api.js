// API router. Endpoints across all user stories (see contracts/api.md).
import { Router } from 'express';
import multer from 'multer';
import { join } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import * as Bookmark from '../models/bookmark.js';
import * as Tag from '../models/tag.js';
import * as SavedSearch from '../models/savedSearch.js';
import * as SavedCopy from '../models/savedCopy.js';
import * as Preferences from '../models/preferences.js';
import { normalizeUrl, deriveTitleFromUrl } from '../lib/url.js';
import { fetchMetadata } from '../services/metadata.js';
import { renderNote } from '../services/markdown.js';
import { parseQuery, matches } from '../services/search.js';
import { createSnapshot } from '../services/snapshot.js';
import { preserve } from '../services/archive.js';
import { exportHtml, importHtml } from '../services/porting.js';
import { tx, SNAPSHOT_DIR } from '../db/connection.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/health', (req, res) => res.json({ ok: true }));

// ---- Helpers ---------------------------------------------------------------
function applyFilters(items, { tag, q }) {
  let out = items;
  if (tag) {
    const want = String(tag).toLowerCase();
    out = out.filter((b) => (b.tags || []).some((t) => t.toLowerCase() === want));
  }
  if (q && String(q).trim()) {
    const ast = parseQuery(q);
    out = out.filter((b) => matches(b, ast));
  }
  return out;
}

// ---- Bookmarks: list (US2/US3/US5/US6/US7) ---------------------------------
router.get('/bookmarks', (req, res, next) => {
  try {
    const prefs = Preferences.get();
    const { view = 'all', tag, q } = req.query;
    const sort = req.query.sort || prefs.default_sort;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Number(req.query.page_size) || prefs.page_size);

    const all = Bookmark.allForView({ view, sort });
    const filtered = applyFilters(all, { tag, q });
    const total = filtered.length;
    const items = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    res.json({ items, total, page, page_size: pageSize });
  } catch (err) {
    next(err);
  }
});

// ---- Bookmarks: create (US1) ----------------------------------------------
router.post('/bookmarks', async (req, res, next) => {
  try {
    const norm = normalizeUrl(req.body?.url);
    if (!norm.ok) return res.status(400).json({ error: norm.error });

    const existing = Bookmark.getByUrl(norm.url);
    if (existing) {
      return res.status(409).json({ error: 'Already bookmarked.', existingId: existing.id });
    }

    const meta = await fetchMetadata(norm.url);
    const userTitle = (req.body?.title || '').trim();
    const title = userTitle || meta.title || deriveTitleFromUrl(norm.url);

    const bookmark = Bookmark.create({
      url: norm.url,
      title,
      description: meta.description || '',
      icon_url: meta.icon_url || '',
      preview_image: meta.preview_image || '',
    });
    if (Array.isArray(req.body?.tags) && req.body.tags.length) {
      Tag.setForBookmark(bookmark.id, req.body.tags);
    }
    res.status(201).json(Bookmark.getById(bookmark.id));
  } catch (err) {
    next(err);
  }
});

// ---- Bookmarks: read one (US1/US4) ----------------------------------------
router.get('/bookmarks/:id', (req, res, next) => {
  try {
    const bookmark = Bookmark.getById(Number(req.params.id));
    if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
    res.json({
      ...bookmark,
      note_html: renderNote(bookmark.note),
      saved_copies: SavedCopy.listForBookmark(bookmark.id),
    });
  } catch (err) {
    next(err);
  }
});

// ---- Bookmarks: edit (US1/US3/US4) ----------------------------------------
router.patch('/bookmarks/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = Bookmark.getById(id);
    if (!existing) return res.status(404).json({ error: 'Bookmark not found.' });

    const fields = {};
    if (typeof req.body?.title === 'string') fields.title = req.body.title.trim();
    if (typeof req.body?.description === 'string') fields.description = req.body.description;
    if (typeof req.body?.note === 'string') fields.note = req.body.note;
    if (typeof req.body?.url === 'string') {
      const norm = normalizeUrl(req.body.url);
      if (!norm.ok) return res.status(400).json({ error: norm.error });
      const clash = Bookmark.getByUrl(norm.url);
      if (clash && clash.id !== id) {
        return res.status(409).json({ error: 'Another bookmark already uses that address.', existingId: clash.id });
      }
      fields.url = norm.url;
    }
    Bookmark.update(id, fields);
    if (Array.isArray(req.body?.tags)) Tag.setForBookmark(id, req.body.tags);

    const updated = Bookmark.getById(id);
    res.json({ ...updated, note_html: renderNote(updated.note) });
  } catch (err) {
    next(err);
  }
});

// ---- Bookmarks: delete (US4) ----------------------------------------------
router.delete('/bookmarks/:id', (req, res, next) => {
  try {
    const ok = Bookmark.remove(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Bookmark not found.' });
    Tag.pruneOrphans();
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// ---- Read-later (US6) ------------------------------------------------------
router.post('/bookmarks/:id/read', (req, res, next) => {
  try {
    res.json(Bookmark.setReadStatus(Number(req.params.id), true));
  } catch (err) {
    next(err);
  }
});
router.post('/bookmarks/:id/unread', (req, res, next) => {
  try {
    res.json(Bookmark.setReadStatus(Number(req.params.id), false));
  } catch (err) {
    next(err);
  }
});

// ---- Archive (US7) ---------------------------------------------------------
router.post('/bookmarks/:id/archive', (req, res, next) => {
  try {
    res.json(Bookmark.setArchivedStatus(Number(req.params.id), true));
  } catch (err) {
    next(err);
  }
});
router.post('/bookmarks/:id/restore', (req, res, next) => {
  try {
    res.json(Bookmark.setArchivedStatus(Number(req.params.id), false));
  } catch (err) {
    next(err);
  }
});

// ---- Bulk actions (US8) ----------------------------------------------------
router.post('/bookmarks/bulk', (req, res, next) => {
  try {
    const { action, tag, confirm } = req.body || {};
    let ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : null;
    if (!ids && req.body?.selector) {
      const { view = 'all', tag: fTag, q } = req.body.selector;
      const all = Bookmark.allForView({ view });
      ids = applyFilters(all, { tag: fTag, q }).map((b) => b.id);
    }
    if (!ids || !ids.length) return res.json({ affected: 0 });

    const ACTIONS = ['add_tag', 'remove_tag', 'mark_read', 'mark_unread', 'archive', 'delete'];
    if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'Unknown bulk action.' });
    if ((action === 'add_tag' || action === 'remove_tag') && !String(tag || '').trim()) {
      return res.status(400).json({ error: 'A tag is required for this action.' });
    }
    if (action === 'delete' && confirm !== true) {
      return res.status(400).json({ error: 'Bulk delete requires confirmation.' });
    }

    const affected = tx(() => {
      for (const id of ids) {
        switch (action) {
          case 'add_tag': Tag.addToBookmark(id, tag); break;
          case 'remove_tag': Tag.removeFromBookmark(id, tag); break;
          case 'mark_read': Bookmark.setReadStatus(id, true); break;
          case 'mark_unread': Bookmark.setReadStatus(id, false); break;
          case 'archive': Bookmark.setArchivedStatus(id, true); break;
          case 'delete': Bookmark.remove(id); break;
        }
      }
      Tag.pruneOrphans();
      return ids.length;
    });
    res.json({ affected });
  } catch (err) {
    next(err);
  }
});

// ---- Tags (US3) ------------------------------------------------------------
router.get('/tags', (req, res, next) => {
  try {
    res.json({ tags: Tag.listByPrefix(req.query.prefix || '', 10) });
  } catch (err) {
    next(err);
  }
});

// ---- Saved searches (US9) --------------------------------------------------
router.get('/saved-searches', (req, res, next) => {
  try {
    res.json({ items: SavedSearch.list() });
  } catch (err) {
    next(err);
  }
});
router.post('/saved-searches', (req, res, next) => {
  try {
    res.status(201).json(SavedSearch.create(req.body || {}));
  } catch (err) {
    next(err);
  }
});
router.delete('/saved-searches/:id', (req, res, next) => {
  try {
    const ok = SavedSearch.remove(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Saved search not found.' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
router.get('/saved-searches/:id/run', (req, res, next) => {
  try {
    const ss = SavedSearch.get(Number(req.params.id));
    if (!ss) return res.status(404).json({ error: 'Saved search not found.' });
    let items = Bookmark.allForView({ view: 'all' });
    items = applyFilters(items, { q: ss.query_text });
    const inc = ss.included_tags.map((t) => t.toLowerCase());
    const exc = ss.excluded_tags.map((t) => t.toLowerCase());
    items = items.filter((b) => {
      const tags = (b.tags || []).map((t) => t.toLowerCase());
      return inc.every((t) => tags.includes(t)) && !exc.some((t) => tags.includes(t));
    });
    res.json({ items, total: items.length, saved_search: ss });
  } catch (err) {
    next(err);
  }
});

// ---- Preferences (US10) ----------------------------------------------------
router.get('/preferences', (req, res, next) => {
  try {
    res.json(Preferences.get());
  } catch (err) {
    next(err);
  }
});
router.put('/preferences', (req, res, next) => {
  try {
    res.json(Preferences.update(req.body || {}));
  } catch (err) {
    next(err);
  }
});

// ---- Saved copies (US11) ---------------------------------------------------
router.post('/bookmarks/:id/snapshot', async (req, res, next) => {
  try {
    const bookmark = Bookmark.getById(Number(req.params.id));
    if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
    const result = await createSnapshot(bookmark);
    SavedCopy.removeKind(bookmark.id, result.kind);
    const copy = SavedCopy.create({ bookmark_id: bookmark.id, kind: result.kind, location: result.filename });
    res.status(201).json(copy);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Could not save a copy.' });
  }
});

router.post('/bookmarks/:id/archive-copy', async (req, res, next) => {
  try {
    const bookmark = Bookmark.getById(Number(req.params.id));
    if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
    const archivedUrl = await preserve(bookmark.url);
    SavedCopy.removeKind(bookmark.id, 'internet_archive');
    const copy = SavedCopy.create({ bookmark_id: bookmark.id, kind: 'internet_archive', location: archivedUrl });
    res.status(201).json(copy);
  } catch (err) {
    // FR-032: report failure honestly; bookmark untouched.
    res.status(502).json({ error: err.message || 'Internet Archive is unavailable.' });
  }
});

router.get('/saved-copies/:id/content', (req, res, next) => {
  try {
    const copy = SavedCopy.get(Number(req.params.id));
    if (!copy) return res.status(404).json({ error: 'Saved copy not found.' });
    if (copy.kind === 'internet_archive') {
      return res.redirect(copy.location);
    }
    const filePath = join(SNAPSHOT_DIR, copy.location);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Saved copy file missing.' });
    res.setHeader('Content-Type', copy.kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
    createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// ---- Import / export (US12) ------------------------------------------------
router.get('/export', (req, res, next) => {
  try {
    const all = Bookmark.allForView({ view: 'all', sort: 'date_added_asc' });
    const archived = Bookmark.allForView({ view: 'archive', sort: 'date_added_asc' });
    const html = exportHtml([...all, ...archived]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

router.post('/import', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No bookmark file uploaded.' });
    const result = tx(() => importHtml(req.file.buffer));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
