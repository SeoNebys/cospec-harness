// Preferences model — single row id=1 (FR-024).
import db from '../db/index.js';

const SORTS = ['newest', 'oldest', 'title', 'updated'];
const SIZES = ['small', 'medium', 'large'];

export function getPreferences() {
  return db.prepare('SELECT default_sort, page_size, text_size FROM preferences WHERE id = 1').get();
}

export function updatePreferences(fields) {
  const cur = getPreferences();
  const default_sort = SORTS.includes(fields.default_sort) ? fields.default_sort : cur.default_sort;
  let page_size = parseInt(fields.page_size, 10);
  if (Number.isNaN(page_size) || page_size < 1) page_size = cur.page_size;
  if (page_size > 500) page_size = 500;
  const text_size = SIZES.includes(fields.text_size) ? fields.text_size : cur.text_size;
  db.prepare('UPDATE preferences SET default_sort = ?, page_size = ?, text_size = ? WHERE id = 1')
    .run(default_sort, page_size, text_size);
  return getPreferences();
}
