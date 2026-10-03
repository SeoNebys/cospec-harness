import { Router } from 'express';
import { listViews, getView, createView, deleteView } from '../db/views.repo.js';
import { runSearch, resolveMatchingIds, SearchSyntaxError } from '../services/search/index.js';
import { serialize, getById, sortClause } from '../db/bookmarks.repo.js';

const router = Router();

// GET /api/views (FR-024)
router.get('/', (_req, res) => {
  res.json({ views: listViews() });
});

// POST /api/views (FR-024)
router.post('/', (req, res) => {
  const { name, searchText, includedTags, excludedTags } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: { code: 'name_required', message: 'A view name is required' } });
  }
  const view = createView({
    name: String(name).trim(),
    searchText: searchText || null,
    includedTags: includedTags || [],
    excludedTags: excludedTags || [],
  });
  res.status(201).json({ view });
});

// GET /api/views/:id/results — resolve the saved combination (FR-024)
router.get('/:id/results', (req, res, next) => {
  try {
    const view = getView(Number(req.params.id));
    if (!view) return res.status(404).json({ error: { code: 'not_found', message: 'View not found' } });

    const sort = req.query.sort || 'newest';
    const ids = resolveMatchingIds({
      q: view.searchText || null,
      includedTags: view.includedTags,
      excludedTags: view.excludedTags,
      view: 'all',
    });
    const rows = ids.map((id) => getById(id)).filter(Boolean);
    // Apply the requested sort in JS (small result sets from a saved view).
    const order = sortClause(sort);
    rows.sort(comparatorFor(order));
    res.json({ items: rows.map(serialize), total: rows.length });
  } catch (e) {
    if (e instanceof SearchSyntaxError) {
      return res.status(400).json({ error: { code: 'bad_query', message: e.message } });
    }
    next(e);
  }
});

// DELETE /api/views/:id (FR-024)
router.delete('/:id', (req, res) => {
  deleteView(Number(req.params.id));
  res.status(204).end();
});

function comparatorFor(order) {
  if (order.startsWith('title')) return (a, b) => a.title.localeCompare(b.title);
  if (order.startsWith('date_added ASC')) return (a, b) => a.date_added.localeCompare(b.date_added);
  if (order.startsWith('date_modified')) return (a, b) => b.date_modified.localeCompare(a.date_modified);
  return (a, b) => b.date_added.localeCompare(a.date_added); // newest
}

export default router;
