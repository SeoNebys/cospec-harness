import express from 'express';
import {
  createBookmark,
  updateBookmark,
  deleteBookmark,
  getById,
  getRawByKey,
  rowToBookmark,
  list,
  bulkApply,
  bulkCount,
} from '../models/bookmark.js';
import { getPreferences } from '../models/preferences.js';
import { isValidUrl, normalizeKey } from '../services/url.js';
import { fetchMetadata } from '../services/metadata.js';
import { SearchQueryError } from '../services/search.js';
import { getDb } from '../db/index.js';

const router = express.Router();

function apiError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// Collect repeatable query params into arrays.
function arrayParam(v) {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// GET /api/bookmarks — list / search / filter (FR-005/014/017-020/022/023/028/040)
router.get('/', (req, res) => {
  const prefs = getPreferences();
  const filters = {
    q: req.query.q || '',
    tag: arrayParam(req.query.tag),
    included_tags: arrayParam(req.query.included_tags),
    excluded_tags: arrayParam(req.query.excluded_tags),
    view: req.query.view || 'active',
    saved_view_id: req.query.saved_view_id
      ? parseInt(req.query.saved_view_id, 10)
      : undefined,
    sort: req.query.sort || prefs.default_sort,
    page: req.query.page,
    page_size: req.query.page_size || prefs.items_per_page,
  };
  try {
    return res.json(list(filters));
  } catch (err) {
    if (err instanceof SearchQueryError) {
      return apiError(res, 400, 'bad_query', err.message);
    }
    throw err;
  }
});

// POST /api/bookmarks — create/save (FR-001..005, 007, 008)
router.post('/', async (req, res) => {
  const { url, title, description, note_html, tags } = req.body || {};
  if (!isValidUrl(url)) {
    return apiError(res, 400, 'invalid_url', 'A valid http/https address is required.');
  }
  const key = normalizeKey(url);
  const existingRaw = getRawByKey(key);
  if (existingRaw) {
    // Duplicate: open the existing bookmark instead of creating (FR-007/008).
    const bookmark = rowToBookmark(existingRaw);
    return res.status(409).json({
      error: { code: 'duplicate', message: 'This address is already bookmarked.' },
      bookmark,
      duplicate: true,
      archived: bookmark.is_archived,
    });
  }
  // Best-effort metadata; user-provided values win.
  const meta = await fetchMetadata(url);
  const bookmark = createBookmark({
    url,
    title: title || meta.title || '',
    description: description || meta.description || '',
    note_html: note_html || '',
    icon_url: meta.icon_url || null,
    preview_image_url: meta.preview_image_url || null,
    tags: tags || [],
  });
  return res.status(201).json({ bookmark });
});

// GET /api/bookmarks/:id
router.get('/:id', (req, res) => {
  const bookmark = getById(parseInt(req.params.id, 10));
  if (!bookmark) return apiError(res, 404, 'not_found', 'Bookmark not found.');
  return res.json({ bookmark });
});

// PATCH /api/bookmarks/:id — edit (FR-003, 009, 021, 023/024)
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getById(id);
  if (!existing) return apiError(res, 404, 'not_found', 'Bookmark not found.');

  const patch = req.body || {};
  if (patch.url !== undefined) {
    if (!isValidUrl(patch.url)) {
      return apiError(res, 400, 'invalid_url', 'A valid http/https address is required.');
    }
    const key = normalizeKey(patch.url);
    const other = getRawByKey(key);
    if (other && other.id !== id) {
      const bookmark = rowToBookmark(other);
      return res.status(409).json({
        error: { code: 'duplicate', message: 'Another bookmark already uses this address.' },
        bookmark,
        duplicate: true,
        archived: bookmark.is_archived,
      });
    }
  }
  const bookmark = updateBookmark(id, patch);
  return res.json({ bookmark });
});

// DELETE /api/bookmarks/:id (FR-038)
router.delete('/:id', (req, res) => {
  const ok = deleteBookmark(parseInt(req.params.id, 10));
  if (!ok) return apiError(res, 404, 'not_found', 'Bookmark not found.');
  return res.status(204).end();
});

// POST /api/bookmarks/bulk — bulk actions (FR-025/025a/026/027)
router.post('/bulk', (req, res) => {
  const { selector, action } = req.body || {};
  if (!selector || !action) {
    return apiError(res, 400, 'bad_request', 'selector and action are required.');
  }
  const destructive = !!action.delete;
  if (destructive && !action.confirm) {
    return apiError(res, 400, 'confirm_required', 'Destructive bulk actions require confirm:true.');
  }
  try {
    const affected = bulkApply(selector, action);
    return res.json({ affected });
  } catch (err) {
    if (err instanceof SearchQueryError) {
      return apiError(res, 400, 'bad_query', err.message);
    }
    throw err;
  }
});

// POST /api/bookmarks/bulk/count — affected-count preview (FR-027)
router.post('/bulk/count', (req, res) => {
  const { selector } = req.body || {};
  if (!selector) return apiError(res, 400, 'bad_request', 'selector is required.');
  try {
    return res.json({ affected: bulkCount(selector) });
  } catch (err) {
    if (err instanceof SearchQueryError) {
      return apiError(res, 400, 'bad_query', err.message);
    }
    throw err;
  }
});

export default router;
