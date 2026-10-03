import { getDb } from '../db/connection.js';

// Look up an existing bookmark by its normalized address (FR-007). Shared by
// save (US1/US2) and address edits (US2) and by import reconciliation (US10).
export function findByNormalizedUrl(normalized) {
  return getDb()
    .prepare('SELECT * FROM bookmark WHERE normalized_url = ?')
    .get(normalized);
}
