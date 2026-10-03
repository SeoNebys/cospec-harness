import express from 'express';
import {
  listSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  runSavedSearch,
} from '../services/savedSearches.js';

export const savedSearchesRouter = express.Router();

savedSearchesRouter.get('/', (req, res) => {
  res.json({ savedSearches: listSavedSearches() });
});

savedSearchesRouter.post('/', (req, res) => {
  res.status(201).json({ savedSearch: createSavedSearch(req.body || {}) });
});

savedSearchesRouter.get('/:id/run', (req, res) => {
  res.json(runSavedSearch(Number(req.params.id)));
});

savedSearchesRouter.put('/:id', (req, res) => {
  res.json({ savedSearch: updateSavedSearch(Number(req.params.id), req.body || {}) });
});

savedSearchesRouter.delete('/:id', (req, res) => {
  const ok = deleteSavedSearch(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: { code: 'not_found', message: 'Saved search not found.' } });
  return res.status(204).end();
});
