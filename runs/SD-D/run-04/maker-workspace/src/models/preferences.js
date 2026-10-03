import { getDb } from '../db/index.js';

const SORTS = ['added_desc', 'added_asc', 'title', 'updated_desc', 'read_status'];
const SIZES = ['small', 'medium', 'large'];

// The single global preferences row (id = 1), not session-scoped (FR-042).
export function getPreferences(db = getDb()) {
  const row = db.prepare('SELECT * FROM preferences WHERE id = 1').get();
  return {
    default_sort: row.default_sort,
    items_per_page: row.items_per_page,
    text_size: row.text_size,
  };
}

export function updatePreferences(patch, db = getDb()) {
  const current = getPreferences(db);
  const next = { ...current };
  if (patch.default_sort !== undefined) {
    if (!SORTS.includes(patch.default_sort)) throw new Error('Invalid default_sort');
    next.default_sort = patch.default_sort;
  }
  if (patch.items_per_page !== undefined) {
    const n = parseInt(patch.items_per_page, 10);
    if (Number.isNaN(n) || n < 1 || n > 500) throw new Error('Invalid items_per_page');
    next.items_per_page = n;
  }
  if (patch.text_size !== undefined) {
    if (!SIZES.includes(patch.text_size)) throw new Error('Invalid text_size');
    next.text_size = patch.text_size;
  }
  db.prepare(
    'UPDATE preferences SET default_sort = ?, items_per_page = ?, text_size = ? WHERE id = 1'
  ).run(next.default_sort, next.items_per_page, next.text_size);
  return next;
}
