import { getDb } from '../db/connection.js';
import { newId } from '../lib/ids.js';

function rowToFilter(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    includeTags: JSON.parse(row.includeTags || '[]'),
    excludeTags: JSON.parse(row.excludeTags || '[]'),
    dateCreated: row.dateCreated,
  };
}

export function listFilters() {
  const db = getDb();
  return db
    .prepare('SELECT * FROM saved_filters ORDER BY name COLLATE NOCASE')
    .all()
    .map(rowToFilter);
}

export function getFilter(id) {
  const db = getDb();
  return rowToFilter(db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id));
}

export function createFilter({ name, query = '', includeTags = [], excludeTags = [] }) {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO saved_filters (id, name, query, includeTags, excludeTags, dateCreated)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, query, JSON.stringify(includeTags), JSON.stringify(excludeTags), new Date().toISOString());
  return getFilter(id);
}

export function updateFilter(id, fields) {
  const db = getDb();
  const current = getFilter(id);
  if (!current) return null;
  const merged = { ...current, ...fields };
  db.prepare(
    `UPDATE saved_filters SET name = ?, query = ?, includeTags = ?, excludeTags = ? WHERE id = ?`
  ).run(
    merged.name,
    merged.query,
    JSON.stringify(merged.includeTags),
    JSON.stringify(merged.excludeTags),
    id
  );
  return getFilter(id);
}

export function deleteFilter(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id);
  return info.changes > 0;
}
