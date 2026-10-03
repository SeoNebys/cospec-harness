import db from '../db/connection.js';

// Saved-view data-access (T053). Stores query + included/excluded tags as rules,
// never a fixed bookmark set (FR-014).

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    query: row.query || '',
    includedTags: JSON.parse(row.included_tags || '[]'),
    excludedTags: JSON.parse(row.excluded_tags || '[]'),
    createdAt: row.created_at,
  };
}

export function listViews() {
  return db.prepare('SELECT * FROM saved_view ORDER BY name COLLATE NOCASE').all().map(serialize);
}

export function getView(id) {
  return serialize(db.prepare('SELECT * FROM saved_view WHERE id = ?').get(id));
}

export function createView({ name, query, includedTags, excludedTags }) {
  const info = db
    .prepare(
      `INSERT INTO saved_view (name, query, included_tags, excluded_tags, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      String(name || 'Untitled view'),
      query || null,
      JSON.stringify(includedTags || []),
      JSON.stringify(excludedTags || []),
      new Date().toISOString()
    );
  return getView(info.lastInsertRowid);
}

export function updateView(id, fields) {
  const existing = getView(id);
  if (!existing) return null;
  db.prepare(
    `UPDATE saved_view SET name = ?, query = ?, included_tags = ?, excluded_tags = ? WHERE id = ?`
  ).run(
    fields.name ?? existing.name,
    fields.query ?? existing.query,
    JSON.stringify(fields.includedTags ?? existing.includedTags),
    JSON.stringify(fields.excludedTags ?? existing.excludedTags),
    id
  );
  return getView(id);
}

export function deleteView(id) {
  return db.prepare('DELETE FROM saved_view WHERE id = ?').run(id).changes > 0;
}
