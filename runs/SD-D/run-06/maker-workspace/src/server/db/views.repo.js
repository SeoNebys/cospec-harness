import { getDb } from './connection.js';

function serializeView(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    searchText: row.search_text,
    includedTags: row.included_tags ? JSON.parse(row.included_tags) : [],
    excludedTags: row.excluded_tags ? JSON.parse(row.excluded_tags) : [],
  };
}

export function listViews() {
  return getDb()
    .prepare('SELECT * FROM saved_view ORDER BY name COLLATE NOCASE')
    .all()
    .map(serializeView);
}

export function getView(id) {
  return serializeView(getDb().prepare('SELECT * FROM saved_view WHERE id = ?').get(id));
}

export function createView({ name, searchText = null, includedTags = [], excludedTags = [] }) {
  const info = getDb()
    .prepare(
      `INSERT INTO saved_view (name, search_text, included_tags, excluded_tags)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      name,
      searchText || null,
      JSON.stringify(includedTags || []),
      JSON.stringify(excludedTags || [])
    );
  return getView(info.lastInsertRowid);
}

export function deleteView(id) {
  getDb().prepare('DELETE FROM saved_view WHERE id = ?').run(id);
}
