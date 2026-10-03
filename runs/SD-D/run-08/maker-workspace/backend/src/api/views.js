import express from 'express';
import { z } from 'zod';
import { listViews, getView, createView, updateView, deleteView } from '../models/views.js';
import { notFound, validationError } from './errors.js';

const router = express.Router();

const viewSchema = z.object({
  name: z.string().min(1),
  query: z.string().optional(),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  sort: z.string().nullable().optional(),
});

router.get('/', (_req, res) => res.json(listViews()));

router.post('/', (req, res, next) => {
  try {
    const body = viewSchema.parse(req.body);
    res.status(201).json(createView(body));
  } catch (err) {
    if (err instanceof z.ZodError) return next(validationError());
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!getView(id)) throw notFound('Saved view not found.');
    const body = viewSchema.partial().parse(req.body);
    res.json(updateView(id, body));
  } catch (err) {
    if (err instanceof z.ZodError) return next(validationError());
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  if (!getView(id)) return next(notFound('Saved view not found.'));
  deleteView(id);
  res.status(204).end();
});

export default router;
