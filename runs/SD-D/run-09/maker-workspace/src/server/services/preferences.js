import { getDb } from '../db/connection.js';
import {
  SORT_KEYS,
  FONT_SIZES,
  ITEMS_PER_PAGE_MIN,
  ITEMS_PER_PAGE_MAX,
} from '../../shared/constants.js';

export function getPreferences() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM display_preferences WHERE id = 1').get();
  return {
    defaultSort: row.defaultSort,
    itemsPerPage: row.itemsPerPage,
    fontSize: row.fontSize,
  };
}

export class PreferencesError extends Error {}

export function updatePreferences(input) {
  const current = getPreferences();
  const next = { ...current, ...input };

  if (!SORT_KEYS.includes(next.defaultSort)) {
    throw new PreferencesError('Invalid defaultSort');
  }
  if (!FONT_SIZES.includes(next.fontSize)) {
    throw new PreferencesError('Invalid fontSize');
  }
  const items = Number(next.itemsPerPage);
  if (!Number.isInteger(items) || items < ITEMS_PER_PAGE_MIN || items > ITEMS_PER_PAGE_MAX) {
    throw new PreferencesError(
      `itemsPerPage must be an integer between ${ITEMS_PER_PAGE_MIN} and ${ITEMS_PER_PAGE_MAX}`
    );
  }

  const db = getDb();
  db.prepare(
    'UPDATE display_preferences SET defaultSort = ?, itemsPerPage = ?, fontSize = ? WHERE id = 1'
  ).run(next.defaultSort, items, next.fontSize);
  return getPreferences();
}
