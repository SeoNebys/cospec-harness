import express from 'express';
import { listFilters, createFilter, deleteFilter } from '../models/filter.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ filters: listFilters() });
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Please name the filter.' });
  const existing = listFilters().find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (existing) return res.status(409).json({ error: 'A filter with that name already exists.' });
  const filter = createFilter({
    name,
    terms: req.body.terms || '',
    include_tags: req.body.include_tags || [],
    exclude_tags: req.body.exclude_tags || [],
  });
  res.status(201).json({ filter });
});

router.delete('/:id', (req, res) => {
  deleteFilter(req.params.id);
  res.status(204).end();
});

export default router;
