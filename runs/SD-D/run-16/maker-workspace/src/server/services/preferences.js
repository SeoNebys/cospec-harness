// Display preferences (single row, id=1). Persisted in SQLite (FR-028).
import { getDb } from '../db/connection.js';

const SORTS = new Set(['newest', 'oldest', 'title', 'updated']);
const SIZES = new Set(['small', 'medium', 'large']);

export function getPreferences() {
  const db = getDb();
  const row = db.prepare('SELECT default_sort, items_shown, text_size FROM preferences WHERE id = 1').get();
  return {
    defaultSort: row.default_sort,
    itemsShown: row.items_shown,
    textSize: row.text_size,
  };
}

export function updatePreferences(patch = {}) {
  const db = getDb();
  const current = getPreferences();
  const defaultSort = patch.defaultSort ?? current.defaultSort;
  const itemsShown = patch.itemsShown ?? current.itemsShown;
  const textSize = patch.textSize ?? current.textSize;

  if (!SORTS.has(defaultSort)) throwBad('defaultSort must be one of newest, oldest, title, updated.');
  if (!SIZES.has(textSize)) throwBad('textSize must be one of small, medium, large.');
  const n = Number(itemsShown);
  if (!Number.isInteger(n) || n < 1 || n > 1000) throwBad('itemsShown must be an integer between 1 and 1000.');

  db.prepare('UPDATE preferences SET default_sort = ?, items_shown = ?, text_size = ? WHERE id = 1').run(defaultSort, n, textSize);
  return getPreferences();
}

function throwBad(message) {
  const e = new Error(message);
  e.status = 400;
  e.code = 'bad_request';
  throw e;
}
