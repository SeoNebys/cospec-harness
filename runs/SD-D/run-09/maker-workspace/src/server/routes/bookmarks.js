import { Router } from 'express';
import { rmSync } from 'node:fs';
import {
  getById,
  getByNormalizedUrl,
  insertBookmark,
  updateBookmark,
  deleteBookmark,
} from '../services/bookmarks.js';
import { normalize, isValidWebUrl, titleFromUrl } from '../services/urlNormalize.js';
import { collectMetadata } from '../services/metadata.js';
import { selectBookmarks, paginate } from '../services/query.js';
import { SearchSyntaxError } from '../services/search/parser.js';
import { enqueue } from '../services/jobQueue.js';
import { preserveInWebArchive } from '../services/webArchive.js';
import { BULK_ACTIONS } from '../../shared/constants.js';

export function bookmarksRouter() {
  const router = Router();

  // --- Preview (collect details before commit; nothing persisted) US1/US2 ---
  router.post('/preview', async (req, res, next) => {
    try {
      const { url } = req.body || {};
      if (!isValidWebUrl(url)) {
        return res.status(400).json({ error: 'Invalid web address' });
      }
      const normalizedUrl = normalize(url);
      const existing = getByNormalizedUrl(normalizedUrl);
      if (existing) {
        return res.json({ existing });
      }
      const meta = await collectMetadata(normalizedUrl);
      return res.json({
        url,
        normalizedUrl,
        title: meta.title,
        description: meta.description,
        faviconPath: meta.faviconPath,
        previewImagePath: meta.previewImagePath,
        metadataStatus: meta.metadataStatus,
        existing: null,
      });
    } catch (err) {
      return next(err);
    }
  });

  // --- Commit (persist reviewed details) US1/US2 ---
  router.post('/', (req, res, next) => {
    try {
      const { url, title, description, note, tags, faviconPath, previewImagePath } = req.body || {};
      if (!isValidWebUrl(url)) {
        return res.status(400).json({ error: 'Invalid web address' });
      }
      const normalizedUrl = normalize(url);
      const existing = getByNormalizedUrl(normalizedUrl);
      if (existing) {
        return res.status(200).json({ ...existing, existing: true });
      }
      const created = insertBookmark({
        url,
        normalizedUrl,
        title: (title && title.trim()) || titleFromUrl(url),
        description: description || '',
        note: note || '',
        tags: tags || [],
        faviconPath: faviconPath || null,
        previewImagePath: previewImagePath || null,
        metadataStatus: 'collected',
        snapshotStatus: 'pending',
      });
      // Background snapshot capture (never overwrites title/description).
      enqueue('snapshot', { bookmarkId: created.id });
      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  });

  // --- List (search/sort/paginate) US3 ---
  router.get('/', (req, res, next) => {
    try {
      const view = req.query.view || 'all';
      const q = req.query.q || '';
      const includeTags = toArray(req.query.includeTags);
      const excludeTags = toArray(req.query.excludeTags);
      const sort = req.query.sort;
      const page = req.query.page ? Number(req.query.page) : 1;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;

      const selected = selectBookmarks({ view, q, includeTags, excludeTags, sort });
      const result = paginate(selected, page, pageSize);
      return res.json(result);
    } catch (err) {
      if (err instanceof SearchSyntaxError) {
        return res.status(400).json({ error: 'Malformed search query', detail: err.message });
      }
      return next(err);
    }
  });

  // --- Bulk actions US6 ---
  router.post('/bulk', (req, res, next) => {
    try {
      const { ids, match, action, value, confirmDelete } = req.body || {};
      if (!BULK_ACTIONS.includes(action)) {
        return res.status(400).json({ error: 'Unknown bulk action' });
      }
      if ((action === 'addTag' || action === 'removeTag') && !value) {
        return res.status(400).json({ error: 'A tag value is required for tag actions' });
      }
      if (action === 'delete' && !confirmDelete) {
        return res.status(400).json({ error: 'confirmDelete is required to bulk delete' });
      }

      let targets = [];
      if (Array.isArray(ids) && ids.length) {
        targets = ids.map(getById).filter(Boolean);
      } else if (match) {
        targets = selectBookmarks({
          view: match.view || 'all',
          q: match.q || '',
          includeTags: match.includeTags || [],
          excludeTags: match.excludeTags || [],
        });
      }

      let affected = 0;
      for (const b of targets) {
        applyBulk(b, action, value);
        affected += 1;
      }
      return res.json({ affected });
    } catch (err) {
      if (err instanceof SearchSyntaxError) {
        return res.status(400).json({ error: 'Malformed search query', detail: err.message });
      }
      return next(err);
    }
  });

  // --- Get one ---
  router.get('/:id', (req, res) => {
    const bm = getById(req.params.id);
    if (!bm) return res.status(404).json({ error: 'Not found' });
    return res.json(bm);
  });

  // --- Edit US4/US5 ---
  router.patch('/:id', (req, res, next) => {
    try {
      const bm = getById(req.params.id);
      if (!bm) return res.status(404).json({ error: 'Not found' });
      const fields = {};
      const { url, title, description, note, tags, read, archived } = req.body || {};

      if (url !== undefined) {
        if (!isValidWebUrl(url)) return res.status(400).json({ error: 'Invalid web address' });
        const normalizedUrl = normalize(url);
        const clash = getByNormalizedUrl(normalizedUrl);
        if (clash && clash.id !== bm.id) {
          return res.status(400).json({ error: 'Another bookmark already uses that address' });
        }
        fields.url = url;
        fields.normalizedUrl = normalizedUrl;
      }
      if (title !== undefined) fields.title = title;
      if (description !== undefined) fields.description = description;
      if (note !== undefined) fields.note = note;
      if (tags !== undefined) fields.tags = tags;
      if (read !== undefined) fields.read = !!read;
      if (archived !== undefined) fields.archived = !!archived;

      const updated = updateBookmark(bm.id, fields);
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  });

  // --- Delete US4 ---
  router.delete('/:id', (req, res) => {
    const bm = getById(req.params.id);
    if (!bm) return res.status(404).json({ error: 'Not found' });
    const removed = deleteBookmark(bm.id);
    if (removed && removed.snapshotPath) {
      try {
        rmSync(removed.snapshotPath, { force: true });
      } catch {
        /* ignore */
      }
    }
    return res.status(204).end();
  });

  // --- Serve snapshot US8 ---
  router.get('/:id/snapshot', (req, res) => {
    const bm = getById(req.params.id);
    if (!bm || bm.snapshotStatus !== 'available' || !bm.snapshotPath) {
      return res.status(404).json({ error: 'No snapshot available' });
    }
    if (bm.snapshotType === 'pdf') {
      res.type('application/pdf');
    } else {
      res.type('text/html');
    }
    return res.sendFile(bm.snapshotPath);
  });

  // --- Internet Archive preservation US8 ---
  router.post('/:id/web-archive', async (req, res, next) => {
    try {
      const bm = getById(req.params.id);
      if (!bm) return res.status(404).json({ error: 'Not found' });
      let archivedUrl;
      try {
        archivedUrl = await preserveInWebArchive(bm.url);
      } catch {
        return res.status(502).json({ error: 'Internet Archive is unavailable' });
      }
      updateBookmark(bm.id, { webArchiveUrl: archivedUrl }, { touch: false });
      return res.json({ webArchiveUrl: archivedUrl });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

function applyBulk(bookmark, action, value) {
  switch (action) {
    case 'addTag': {
      const tags = Array.from(new Set([...(bookmark.tags || []), String(value).replace(/^#/, '')]));
      updateBookmark(bookmark.id, { tags });
      break;
    }
    case 'removeTag': {
      const v = String(value).replace(/^#/, '').toLowerCase();
      const tags = (bookmark.tags || []).filter((t) => t.toLowerCase() !== v);
      updateBookmark(bookmark.id, { tags });
      break;
    }
    case 'markRead':
      updateBookmark(bookmark.id, { read: true });
      break;
    case 'markUnread':
      updateBookmark(bookmark.id, { read: false });
      break;
    case 'archive':
      updateBookmark(bookmark.id, { archived: true });
      break;
    case 'unarchive':
      updateBookmark(bookmark.id, { archived: false });
      break;
    case 'delete': {
      const removed = deleteBookmark(bookmark.id);
      if (removed && removed.snapshotPath) {
        try {
          rmSync(removed.snapshotPath, { force: true });
        } catch {
          /* ignore */
        }
      }
      break;
    }
    default:
      break;
  }
}

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
