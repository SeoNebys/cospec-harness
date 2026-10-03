// Personal display preferences (FR-027) — a singleton row.
import db from '../db/index.js';

const VALID_SORTS = ['date_added_desc', 'date_added_asc', 'title_asc', 'title_desc'];
const VALID_SIZES = ['small', 'medium', 'large'];

export function get() {
  const row = db.prepare('SELECT * FROM preferences WHERE id = 1').get();
  return {
    defaultSort: row.default_sort,
    itemsPerView: row.items_per_view,
    textSize: row.text_size,
  };
}

export function set({ defaultSort, itemsPerView, textSize }) {
  const cur = get();
  const sort = VALID_SORTS.includes(defaultSort) ? defaultSort : cur.defaultSort;
  const size = VALID_SIZES.includes(textSize) ? textSize : cur.textSize;
  let count = parseInt(itemsPerView, 10);
  if (!Number.isFinite(count) || count < 1) count = cur.itemsPerView;
  count = Math.min(count, 500);
  db.prepare(
    'UPDATE preferences SET default_sort = ?, items_per_view = ?, text_size = ? WHERE id = 1'
  ).run(sort, count, size);
  return get();
}
