import express from 'express';
import { db } from '../db.js';
import { ValidationError } from '../services/url.js';

export const router = express.Router();

const SORTS = ['date_added_desc', 'date_added_asc', 'title_asc', 'title_desc'];
const DENSITIES = ['comfortable', 'compact'];
const SIZES = ['small', 'medium', 'large'];

const getStmt = db.prepare('SELECT default_sort, density, text_size FROM preferences WHERE id = 1');
const updateStmt = db.prepare(`
  UPDATE preferences SET default_sort=@default_sort, density=@density, text_size=@text_size WHERE id=1
`);

router.get('/', (_req, res) => {
  res.json(getStmt.get());
});

router.put('/', (req, res) => {
  const b = req.body || {};
  const current = getStmt.get();
  const default_sort = b.default_sort ?? current.default_sort;
  const density = b.density ?? current.density;
  const text_size = b.text_size ?? current.text_size;
  if (!SORTS.includes(default_sort)) throw new ValidationError('Invalid default_sort.');
  if (!DENSITIES.includes(density)) throw new ValidationError('Invalid density.');
  if (!SIZES.includes(text_size)) throw new ValidationError('Invalid text_size.');
  updateStmt.run({ default_sort, density, text_size });
  res.json(getStmt.get());
});
