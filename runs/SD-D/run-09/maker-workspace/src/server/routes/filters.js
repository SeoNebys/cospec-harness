import { Router } from 'express';
import {
  listFilters,
  getFilter,
  createFilter,
  updateFilter,
  deleteFilter,
} from '../services/filters.js';

export function filtersRouter() {
  const router = Router();

  router.get('/', (_req, res) => res.json(listFilters()));

  router.post('/', (req, res) => {
    const { name, query, includeTags, excludeTags } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'A filter name is required' });
    try {
      const created = createFilter({ name: name.trim(), query, includeTags, excludeTags });
      return res.status(201).json(created);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(400).json({ error: 'A filter with that name already exists' });
      }
      throw err;
    }
  });

  router.patch('/:id', (req, res) => {
    const existing = getFilter(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = updateFilter(req.params.id, req.body || {});
    return res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const ok = deleteFilter(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.status(204).end();
  });

  return router;
}
