import { Router, Request, Response } from 'express';
import {
  listFilters,
  createFilter,
  updateFilter,
  deleteFilter,
  getFilter,
} from '../models/filters';

export const filtersRouter = Router();

filtersRouter.get('/', (_req: Request, res: Response) => {
  return res.json({ filters: listFilters() });
});

filtersRouter.post('/', (req: Request, res: Response) => {
  const { name, search_expression, includedTagIds, excludedTagIds } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: { code: 'bad_name', message: 'A filter name is required.' } });
  }
  return res.status(201).json(createFilter({ name, search_expression, includedTagIds, excludedTagIds }));
});

filtersRouter.patch('/:id(\\d+)', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!getFilter(id)) return res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
  const { name, search_expression, includedTagIds, excludedTagIds } = req.body ?? {};
  return res.json(updateFilter(id, { name, search_expression, includedTagIds, excludedTagIds }));
});

filtersRouter.delete('/:id(\\d+)', (req: Request, res: Response) => {
  deleteFilter(Number(req.params.id));
  return res.status(204).end();
});
