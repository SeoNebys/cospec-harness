import { Router } from 'express';
import * as Views from '../models/savedView.js';
import { runQuery } from '../services/query.js';
import { SearchSyntaxError } from '../services/search/parser.js';

const router = Router();

// GET /api/views (FR-014)
router.get('/views', (req, res) => {
  res.json({ views: Views.listViews() });
});

// POST /api/views
router.post('/views', (req, res) => {
  const { name, query, includedTags, excludedTags } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'A view name is required.' });
  res.status(201).json(Views.createView({ name, query, includedTags, excludedTags }));
});

// PATCH /api/views/:id
router.patch('/views/:id', (req, res) => {
  const updated = Views.updateView(Number(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Saved view not found.' });
  res.json(updated);
});

// DELETE /api/views/:id
router.delete('/views/:id', (req, res) => {
  const ok = Views.deleteView(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Saved view not found.' });
  res.status(204).end();
});

// GET /api/views/:id/results — resolve live against the collection (FR-014).
router.get('/views/:id/results', (req, res) => {
  const view = Views.getView(Number(req.params.id));
  if (!view) return res.status(404).json({ error: 'Saved view not found.' });
  try {
    const bookmarks = runQuery({
      view: 'normal',
      q: view.query,
      includeTags: view.includedTags,
      excludeTags: view.excludedTags,
      sort: req.query.sort || 'newest',
    });
    res.json({ bookmarks, total: bookmarks.length });
  } catch (err) {
    if (err instanceof SearchSyntaxError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

export default router;
