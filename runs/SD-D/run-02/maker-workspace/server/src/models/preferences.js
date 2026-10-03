// Preferences singleton (FR-038).
import { SORT_KEYS } from '../lib/viewQuery.js';

export function getPreferences(db) {
  const row = db.prepare('SELECT * FROM preferences WHERE id = 1').get();
  return {
    default_sort: row.default_sort,
    items_per_page: row.items_per_page,
    font_size: row.font_size,
  };
}

export function updatePreferences(db, body) {
  const cur = getPreferences(db);
  const next = { ...cur, ...pick(body) };

  if (!SORT_KEYS.has(next.default_sort)) {
    throw validationError('Unsupported default sort order.');
  }
  const ipp = Number(next.items_per_page);
  if (!Number.isInteger(ipp) || ipp <= 0) {
    throw validationError('Items per page must be a positive whole number.');
  }
  if (!['small', 'medium', 'large'].includes(next.font_size)) {
    throw validationError('Font size must be small, medium, or large.');
  }

  db.prepare(
    'UPDATE preferences SET default_sort = ?, items_per_page = ?, font_size = ? WHERE id = 1'
  ).run(next.default_sort, ipp, next.font_size);
  return getPreferences(db);
}

function pick(body) {
  const out = {};
  for (const k of ['default_sort', 'items_per_page', 'font_size']) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

function validationError(message) {
  const e = new Error(message);
  e.code = 'validation';
  return e;
}
