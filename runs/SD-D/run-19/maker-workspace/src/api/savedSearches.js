import { Router } from 'express';
import { listSavedSearches, createSavedSearch, deleteSavedSearch } from '../models/savedSearch.js';

const router = Router();

router.get('/', (req, res) => res.json({ items: listSavedSearches() }));

router.post('/', (req, res) => {
  const { name, queryText, includeTags, excludeTags } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: { code: 'invalid', message: 'A name is required' } });
  }
  res.status(201).json(createSavedSearch({ name, queryText, includeTags, excludeTags }));
});

router.delete('/:id', (req, res) => {
  const ok = deleteSavedSearch(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: { code: 'not-found', message: 'Saved search not found' } });
  res.status(204).end();
});

export default router;
