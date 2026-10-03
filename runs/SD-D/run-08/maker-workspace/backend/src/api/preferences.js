import express from 'express';
import { z } from 'zod';
import { getPreferences, updatePreferences } from '../models/preferences.js';
import { validationError } from './errors.js';

const router = express.Router();

router.get('/', (_req, res) => res.json(getPreferences()));

const prefSchema = z.object({
  defaultSort: z.enum(['created_desc', 'created_asc', 'title_asc', 'title_desc']).optional(),
  itemsPerPage: z.number().int().positive().max(500).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
});

router.put('/', (req, res, next) => {
  try {
    const body = prefSchema.parse(req.body);
    res.json(updatePreferences(body));
  } catch (err) {
    if (err instanceof z.ZodError) return next(validationError());
    next(err);
  }
});

export default router;
