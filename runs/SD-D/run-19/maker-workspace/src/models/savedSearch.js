import { getDb } from '../db/index.js';

function rowToSaved(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    queryText: row.query_text || '',
    includeTags: JSON.parse(row.include_tags || '[]'),
    excludeTags: JSON.parse(row.exclude_tags || '[]'),
    dateAdded: row.date_added,
  };
}

export function listSavedSearches() {
  return getDb().prepare('SELECT * FROM saved_search ORDER BY name COLLATE NOCASE').all().map(rowToSaved);
}

export function createSavedSearch({ name, queryText = '', includeTags = [], excludeTags = [] }) {
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO saved_search (name, query_text, include_tags, exclude_tags, date_added)
     VALUES (?, ?, ?, ?, ?)`
  ).run(String(name).trim(), queryText, JSON.stringify(includeTags), JSON.stringify(excludeTags), new Date().toISOString());
  return rowToSaved(db.prepare('SELECT * FROM saved_search WHERE id = ?').get(info.lastInsertRowid));
}

export function deleteSavedSearch(id) {
  return getDb().prepare('DELETE FROM saved_search WHERE id = ?').run(id).changes > 0;
}
