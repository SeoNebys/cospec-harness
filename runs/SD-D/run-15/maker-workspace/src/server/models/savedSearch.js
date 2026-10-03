// T045 [US9]: Saved-search data-access.
import db from '../db/connection.js';

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    query_text: row.query_text,
    included_tags: JSON.parse(row.included_tags || '[]'),
    excluded_tags: JSON.parse(row.excluded_tags || '[]'),
    created_at: row.created_at,
  };
}

export function create({ name, query_text = '', included_tags = [], excluded_tags = [] }) {
  const info = db
    .prepare(
      `INSERT INTO saved_searches (name, query_text, included_tags, excluded_tags, created_at)
       VALUES (@name, @query_text, @included, @excluded, @ts)`
    )
    .run({
      name: String(name || '').trim() || 'Untitled search',
      query_text: String(query_text || ''),
      included: JSON.stringify(included_tags || []),
      excluded: JSON.stringify(excluded_tags || []),
      ts: new Date().toISOString(),
    });
  return get(info.lastInsertRowid);
}

export function list() {
  return db
    .prepare('SELECT * FROM saved_searches ORDER BY created_at DESC, id DESC')
    .all()
    .map(hydrate);
}

export function get(id) {
  return hydrate(db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id));
}

export function remove(id) {
  return db.prepare('DELETE FROM saved_searches WHERE id = ?').run(id).changes > 0;
}
