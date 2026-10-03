import type Database from 'better-sqlite3';
import { getDb } from '../db/connection';
import { DisplayPreferences, SortOrder, TextSize } from '../types';

const SORTS: SortOrder[] = ['saved_desc', 'saved_asc', 'title_asc', 'title_desc', 'updated_desc'];
const SIZES: TextSize[] = ['small', 'medium', 'large'];

export function getPreferences(db: Database.Database = getDb()): DisplayPreferences {
  const row = db
    .prepare('SELECT default_sort, page_size, text_size FROM display_preferences WHERE id = 1')
    .get() as DisplayPreferences;
  return row;
}

export function updatePreferences(
  patch: Partial<DisplayPreferences>,
  db: Database.Database = getDb()
): DisplayPreferences {
  const current = getPreferences(db);
  const next: DisplayPreferences = {
    default_sort: SORTS.includes(patch.default_sort as SortOrder)
      ? (patch.default_sort as SortOrder)
      : current.default_sort,
    page_size:
      typeof patch.page_size === 'number' && patch.page_size > 0
        ? Math.min(500, Math.floor(patch.page_size))
        : current.page_size,
    text_size: SIZES.includes(patch.text_size as TextSize)
      ? (patch.text_size as TextSize)
      : current.text_size,
  };
  db.prepare(
    'UPDATE display_preferences SET default_sort = ?, page_size = ?, text_size = ? WHERE id = 1'
  ).run(next.default_sort, next.page_size, next.text_size);
  return next;
}
