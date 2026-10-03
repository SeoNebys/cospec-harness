import express from 'express';
import { db } from '../db/db.js';

export const router = express.Router();

const SORTS = ['date_added', 'title', 'last_updated'];
const SIZES = ['small', 'medium', 'large'];

router.get('/', (req, res) => {
  const prefs = db.prepare('SELECT default_sort, items_per_page, text_size FROM preferences WHERE id = 1').get();
  res.json({ preferences: prefs });
});

router.put('/', (req, res) => {
  const cur = db.prepare('SELECT default_sort, items_per_page, text_size FROM preferences WHERE id = 1').get();
  const b = req.body || {};
  const default_sort = SORTS.includes(b.default_sort) ? b.default_sort : cur.default_sort;
  const text_size = SIZES.includes(b.text_size) ? b.text_size : cur.text_size;
  let items_per_page = parseInt(b.items_per_page, 10);
  if (!Number.isInteger(items_per_page) || items_per_page < 1 || items_per_page > 500) items_per_page = cur.items_per_page;
  db.prepare('UPDATE preferences SET default_sort = ?, items_per_page = ?, text_size = ? WHERE id = 1')
    .run(default_sort, items_per_page, text_size);
  res.json({ preferences: { default_sort, items_per_page, text_size } });
});
