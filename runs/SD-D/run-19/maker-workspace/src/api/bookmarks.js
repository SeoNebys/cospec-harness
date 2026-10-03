import { Router } from 'express';
import {
  createBookmark, updateBookmark, deleteBookmark, getById, findByUrlKey,
  listBookmarks, resolveMatchingIds, applyBulkAction, ConflictError,
} from '../models/bookmark.js';
import { fetchMetadata } from '../services/metadata.js';
import { canonicalKey, isValidHttpUrl, InvalidUrlError } from '../lib/url.js';

const router = Router();

function parseCsv(v) { return v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []; }

// Metadata preview before first save (FR-003a); flags an existing duplicate.
router.post('/preview', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!isValidHttpUrl(url)) return res.status(400).json({ error: { code: 'invalid-url', message: 'Not a valid web address' } });
    const existing = findByUrlKey(canonicalKey(url));
    const meta = await fetchMetadata(url);
    res.json({ url, urlKey: canonicalKey(url), ...meta, existing: existing ? { id: existing.id } : null });
  } catch (err) { next(err); }
});

// List for the current view.
router.get('/', (req, res, next) => {
  try {
    const result = listBookmarks({
      q: req.query.q,
      includeTags: parseCsv(req.query.includeTags),
      excludeTags: parseCsv(req.query.excludeTags),
      scope: req.query.scope || 'all',
      sort: req.query.sort,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json(result);
  } catch (err) {
    if (err.name === 'SearchSyntaxError') {
      return res.status(400).json({ error: { code: err.code, message: err.message } });
    }
    next(err);
  }
});

// Bulk actions over explicit ids or the whole current view.
router.post('/bulk', (req, res, next) => {
  try {
    const { selection, action, tags = [], confirmed } = req.body;
    if (action === 'delete' && !confirmed) {
      return res.status(400).json({ error: { code: 'confirmation-required', message: 'Delete must be confirmed' } });
    }
    let ids = [];
    if (selection?.ids) ids = selection.ids;
    else if (selection?.matchAll) {
      ids = resolveMatchingIds({
        q: selection.matchAll.q,
        includeTags: parseCsv(selection.matchAll.includeTags),
        excludeTags: parseCsv(selection.matchAll.excludeTags),
        scope: selection.matchAll.scope || 'all',
      });
    }
    const affected = applyBulkAction(ids, action, tags);
    res.json({ affected });
  } catch (err) {
    if (err.name === 'SearchSyntaxError') {
      return res.status(400).json({ error: { code: err.code, message: err.message } });
    }
    next(err);
  }
});

router.get('/:id', (req, res) => {
  const bookmark = getById(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: { code: 'not-found', message: 'Bookmark not found' } });
  res.json(bookmark);
});

// Create.
router.post('/', (req, res, next) => {
  try {
    const bookmark = createBookmark(req.body);
    res.status(201).json(bookmark);
  } catch (err) {
    if (err instanceof ConflictError) return res.status(200).json({ existing: { id: err.existingId } });
    if (err instanceof InvalidUrlError) return res.status(400).json({ error: { code: 'invalid-url', message: err.message } });
    next(err);
  }
});

// Edit.
router.patch('/:id', (req, res, next) => {
  try {
    const bookmark = updateBookmark(Number(req.params.id), req.body);
    if (!bookmark) return res.status(404).json({ error: { code: 'not-found', message: 'Bookmark not found' } });
    res.json(bookmark);
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ error: { code: 'url-conflict', message: err.message }, existing: { id: err.existingId } });
    }
    if (err instanceof InvalidUrlError) return res.status(400).json({ error: { code: 'invalid-url', message: err.message } });
    next(err);
  }
});

// Permanent delete.
router.delete('/:id', (req, res) => {
  const ok = deleteBookmark(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: { code: 'not-found', message: 'Bookmark not found' } });
  res.status(204).end();
});

export default router;
