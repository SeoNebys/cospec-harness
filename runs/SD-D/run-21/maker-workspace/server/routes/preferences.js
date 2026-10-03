import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

const SORTS = ['newest', 'oldest', 'title_az', 'title_za', 'recently_updated'];
const DENSITIES = ['comfortable', 'compact'];
const SIZES = ['small', 'medium', 'large'];

function readPrefs() {
  const row = db.prepare('SELECT * FROM preferences WHERE id = 1').get();
  return { defaultSort: row.default_sort, density: row.density, textSize: row.text_size };
}

// GET /api/preferences (FR-028)
router.get('/preferences', (req, res) => {
  res.json(readPrefs());
});

// PUT /api/preferences (FR-028)
router.put('/preferences', (req, res) => {
  const current = db.prepare('SELECT * FROM preferences WHERE id = 1').get();
  const defaultSort = req.body?.defaultSort ?? current.default_sort;
  const density = req.body?.density ?? current.density;
  const textSize = req.body?.textSize ?? current.text_size;
  if (!SORTS.includes(defaultSort) || !DENSITIES.includes(density) || !SIZES.includes(textSize)) {
    return res.status(400).json({ error: 'Invalid preference value.' });
  }
  db.prepare('UPDATE preferences SET default_sort = ?, density = ?, text_size = ? WHERE id = 1').run(
    defaultSort,
    density,
    textSize
  );
  res.json(readPrefs());
});

export default router;
