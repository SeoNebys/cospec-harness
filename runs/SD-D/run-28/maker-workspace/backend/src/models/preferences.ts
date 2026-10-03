import type { DB } from '../db/db.ts';

export interface Preferences {
  defaultSort: string;
  itemsShown: number;
  textSize: string;
}

const VALID_SORTS = new Set([
  'date_added_desc',
  'date_added_asc',
  'date_modified_desc',
  'date_modified_asc',
  'title_asc',
  'title_desc',
  'unread_first',
]);
const VALID_SIZES = new Set(['small', 'medium', 'large']);

export function getPreferences(db: DB): Preferences {
  const row = db
    .prepare('SELECT default_sort, items_shown, text_size FROM preferences WHERE id = 1')
    .get() as { default_sort: string; items_shown: number; text_size: string };
  return {
    defaultSort: row.default_sort,
    itemsShown: row.items_shown,
    textSize: row.text_size,
  };
}

export function updatePreferences(db: DB, patch: Partial<Preferences>): Preferences {
  const current = getPreferences(db);
  const next: Preferences = {
    defaultSort:
      patch.defaultSort && VALID_SORTS.has(patch.defaultSort)
        ? patch.defaultSort
        : current.defaultSort,
    itemsShown:
      typeof patch.itemsShown === 'number' && patch.itemsShown > 0 && patch.itemsShown <= 500
        ? Math.floor(patch.itemsShown)
        : current.itemsShown,
    textSize:
      patch.textSize && VALID_SIZES.has(patch.textSize) ? patch.textSize : current.textSize,
  };
  db.prepare(
    'UPDATE preferences SET default_sort = ?, items_shown = ?, text_size = ? WHERE id = 1',
  ).run(next.defaultSort, next.itemsShown, next.textSize);
  return next;
}
