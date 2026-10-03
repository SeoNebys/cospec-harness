import { getDb } from '../db/index.js';

const SORTS = new Set(['date_added_desc', 'date_added_asc', 'title_asc', 'title_desc']);
const SIZES = new Set(['small', 'medium', 'large']);

export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}

function rowToPrefs(row) {
  return {
    defaultSort: row.default_sort,
    itemsPerPage: row.items_per_page,
    textSize: row.text_size,
  };
}

export function getPreferences() {
  return rowToPrefs(getDb().prepare('SELECT * FROM preferences WHERE id = 1').get());
}

export function updatePreferences({ defaultSort, itemsPerPage, textSize }) {
  if (!SORTS.has(defaultSort)) throw new ValidationError('Invalid default sort');
  if (!SIZES.has(textSize)) throw new ValidationError('Invalid text size');
  const perPage = parseInt(itemsPerPage, 10);
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 500) {
    throw new ValidationError('Items per page must be between 1 and 500');
  }
  getDb().prepare('UPDATE preferences SET default_sort = ?, items_per_page = ?, text_size = ? WHERE id = 1')
    .run(defaultSort, perPage, textSize);
  return getPreferences();
}
