import { stmt } from '../db/index.js';

const VALID_SORTS = ['created_desc', 'created_asc', 'title_asc', 'title_desc'];
const VALID_FONT = ['small', 'medium', 'large'];

export function getPreferences() {
  const row = stmt('SELECT * FROM preferences WHERE id = 1').get();
  return {
    defaultSort: row.default_sort,
    itemsPerPage: row.items_per_page,
    fontSize: row.font_size,
  };
}

export function updatePreferences({ defaultSort, itemsPerPage, fontSize }) {
  const current = getPreferences();
  const sort = VALID_SORTS.includes(defaultSort) ? defaultSort : current.defaultSort;
  const perPage =
    Number.isInteger(itemsPerPage) && itemsPerPage > 0 && itemsPerPage <= 500
      ? itemsPerPage
      : current.itemsPerPage;
  const font = VALID_FONT.includes(fontSize) ? fontSize : current.fontSize;
  stmt(
    'UPDATE preferences SET default_sort = ?, items_per_page = ?, font_size = ? WHERE id = 1'
  ).run(sort, perPage, font);
  return getPreferences();
}
