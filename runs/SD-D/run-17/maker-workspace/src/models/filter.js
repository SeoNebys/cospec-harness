// SavedFilter model (FR-019).
import db from '../db/index.js';

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    terms: row.terms || '',
    include_tags: JSON.parse(row.include_tags || '[]'),
    exclude_tags: JSON.parse(row.exclude_tags || '[]'),
    created_at: row.created_at,
  };
}

export function listFilters() {
  return db.prepare('SELECT * FROM saved_filters ORDER BY name COLLATE NOCASE').all().map(hydrate);
}

export function createFilter({ name, terms, include_tags, exclude_tags }) {
  const info = db.prepare(
    `INSERT INTO saved_filters (name, terms, include_tags, exclude_tags, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    String(name).trim(),
    terms || '',
    JSON.stringify(include_tags || []),
    JSON.stringify(exclude_tags || []),
    new Date().toISOString()
  );
  return hydrate(db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(info.lastInsertRowid));
}

export function deleteFilter(id) {
  db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id);
}
