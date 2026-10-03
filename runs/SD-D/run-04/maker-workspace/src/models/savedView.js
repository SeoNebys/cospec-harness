import { getDb } from '../db/index.js';

function rowToView(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    included_tags: JSON.parse(row.included_tags || '[]'),
    excluded_tags: JSON.parse(row.excluded_tags || '[]'),
    created_at: row.created_at,
  };
}

export function listViews(db = getDb()) {
  return db
    .prepare('SELECT * FROM saved_views ORDER BY name COLLATE NOCASE')
    .all()
    .map(rowToView);
}

export function getView(id, db = getDb()) {
  return rowToView(db.prepare('SELECT * FROM saved_views WHERE id = ?').get(id));
}

export function createView(
  { name, query = '', included_tags = [], excluded_tags = [] },
  db = getDb()
) {
  const info = db
    .prepare(
      `INSERT INTO saved_views (name, query, included_tags, excluded_tags, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      name,
      query,
      JSON.stringify(included_tags || []),
      JSON.stringify(excluded_tags || []),
      new Date().toISOString()
    );
  return getView(info.lastInsertRowid, db);
}

export function updateView(id, patch, db = getDb()) {
  const existing = db.prepare('SELECT * FROM saved_views WHERE id = ?').get(id);
  if (!existing) return null;
  const name = patch.name !== undefined ? patch.name : existing.name;
  const query = patch.query !== undefined ? patch.query : existing.query;
  const included =
    patch.included_tags !== undefined
      ? JSON.stringify(patch.included_tags)
      : existing.included_tags;
  const excluded =
    patch.excluded_tags !== undefined
      ? JSON.stringify(patch.excluded_tags)
      : existing.excluded_tags;
  db.prepare(
    'UPDATE saved_views SET name = ?, query = ?, included_tags = ?, excluded_tags = ? WHERE id = ?'
  ).run(name, query, included, excluded, id);
  return getView(id, db);
}

export function deleteView(id, db = getDb()) {
  return db.prepare('DELETE FROM saved_views WHERE id = ?').run(id).changes > 0;
}
