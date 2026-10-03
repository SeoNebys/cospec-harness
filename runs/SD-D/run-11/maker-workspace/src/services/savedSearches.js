// Saved searches: named query + included/excluded tag sets (FR-021).
import db from '../db/index.js';

function rowToSaved(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    query: row.query || '',
    includedTags: row.included_tags ? JSON.parse(row.included_tags) : [],
    excludedTags: row.excluded_tags ? JSON.parse(row.excluded_tags) : [],
    createdAt: row.created_at,
  };
}

export function list() {
  return db
    .prepare('SELECT * FROM saved_search ORDER BY name COLLATE NOCASE')
    .all()
    .map(rowToSaved);
}

export function getById(id) {
  return rowToSaved(db.prepare('SELECT * FROM saved_search WHERE id = ?').get(id));
}

export function create({ name, query, includedTags, excludedTags }) {
  const info = db
    .prepare(
      `INSERT INTO saved_search (name, query, included_tags, excluded_tags, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      String(name).trim(),
      query || '',
      JSON.stringify(includedTags || []),
      JSON.stringify(excludedTags || []),
      new Date().toISOString()
    );
  return getById(info.lastInsertRowid);
}

export function update(id, fields) {
  const existing = getById(id);
  if (!existing) return null;
  const name = fields.name !== undefined ? String(fields.name).trim() : existing.name;
  const query = fields.query !== undefined ? fields.query : existing.query;
  const included =
    fields.includedTags !== undefined ? fields.includedTags : existing.includedTags;
  const excluded =
    fields.excludedTags !== undefined ? fields.excludedTags : existing.excludedTags;
  db.prepare(
    `UPDATE saved_search SET name = ?, query = ?, included_tags = ?, excluded_tags = ? WHERE id = ?`
  ).run(name, query, JSON.stringify(included), JSON.stringify(excluded), id);
  return getById(id);
}

export function remove(id) {
  return db.prepare('DELETE FROM saved_search WHERE id = ?').run(id).changes > 0;
}
