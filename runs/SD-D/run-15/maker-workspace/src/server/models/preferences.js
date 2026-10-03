// T049 [US10]: Preferences (single row) data-access.
import db from '../db/connection.js';

const VALID_SORTS = ['date_added_desc', 'date_added_asc', 'title_asc', 'title_desc'];
const VALID_TEXT = ['small', 'medium', 'large'];

export function get() {
  const row = db.prepare('SELECT default_sort, page_size, text_size FROM preferences WHERE id = 1').get();
  return row || { default_sort: 'date_added_desc', page_size: 25, text_size: 'medium' };
}

export function update(fields = {}) {
  const current = get();
  const next = {
    default_sort: VALID_SORTS.includes(fields.default_sort) ? fields.default_sort : current.default_sort,
    page_size:
      Number.isInteger(Number(fields.page_size)) && Number(fields.page_size) > 0
        ? Math.min(500, Number(fields.page_size))
        : current.page_size,
    text_size: VALID_TEXT.includes(fields.text_size) ? fields.text_size : current.text_size,
  };
  db.prepare(
    'UPDATE preferences SET default_sort = @default_sort, page_size = @page_size, text_size = @text_size WHERE id = 1'
  ).run(next);
  return get();
}
