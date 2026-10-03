import express from 'express';
import {
  listViews,
  getView,
  createView,
  updateView,
  deleteView,
} from '../models/savedView.js';
import { list } from '../models/bookmark.js';
import { getPreferences } from '../models/preferences.js';
import { SearchQueryError } from '../services/search.js';

const router = express.Router();

function apiError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// GET /api/views (FR-029)
router.get('/', (req, res) => {
  res.json({ views: listViews() });
});

// POST /api/views (FR-029)
router.post('/', (req, res) => {
  const { name, query, included_tags, excluded_tags } = req.body || {};
  if (!name || !name.trim()) {
    return apiError(res, 400, 'bad_request', 'A view name is required.');
  }
  const view = createView({
    name: name.trim(),
    query: query || '',
    included_tags: included_tags || [],
    excluded_tags: excluded_tags || [],
  });
  res.status(201).json({ view });
});

// PATCH /api/views/:id (FR-029)
router.patch('/:id', (req, res) => {
  const view = updateView(parseInt(req.params.id, 10), req.body || {});
  if (!view) return apiError(res, 404, 'not_found', 'Saved view not found.');
  res.json({ view });
});

// DELETE /api/views/:id (FR-029)
router.delete('/:id', (req, res) => {
  const ok = deleteView(parseInt(req.params.id, 10));
  if (!ok) return apiError(res, 404, 'not_found', 'Saved view not found.');
  res.status(204).end();
});

// GET /api/views/:id/results — re-apply the view's filters (FR-030)
router.get('/:id/results', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const view = getView(id);
  if (!view) return apiError(res, 404, 'not_found', 'Saved view not found.');
  const prefs = getPreferences();
  try {
    const result = list({
      saved_view_id: id,
      sort: req.query.sort || prefs.default_sort,
      page: req.query.page,
      page_size: req.query.page_size || prefs.items_per_page,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof SearchQueryError) {
      return apiError(res, 400, 'bad_query', err.message);
    }
    throw err;
  }
});

export default router;
