import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

const SORTS = new Set(['newest', 'oldest', 'title', 'recently_modified']);
const SIZES = new Set(['small', 'medium', 'large']);

function readPrefs() {
  const row = getDb().prepare('SELECT * FROM display_preferences WHERE id = 1').get();
  return {
    defaultSort: row.default_sort,
    itemsPerView: row.items_per_view,
    textSize: row.text_size,
  };
}

// GET /api/preferences (FR-035)
router.get('/', (_req, res) => {
  res.json(readPrefs());
});

// PUT /api/preferences (FR-035)
router.put('/', (req, res) => {
  const current = readPrefs();
  const { defaultSort, itemsPerView, textSize } = req.body || {};

  const sort = SORTS.has(defaultSort) ? defaultSort : current.defaultSort;
  const size = SIZES.has(textSize) ? textSize : current.textSize;
  let items = Number(itemsPerView);
  if (!Number.isInteger(items) || items < 1 || items > 500) items = current.itemsPerView;

  getDb()
    .prepare('UPDATE display_preferences SET default_sort = ?, items_per_view = ?, text_size = ? WHERE id = 1')
    .run(sort, items, size);
  res.json(readPrefs());
});

export default router;
