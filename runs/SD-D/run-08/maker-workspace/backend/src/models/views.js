import { stmt } from '../db/index.js';

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    includeTags: JSON.parse(row.include_tags || '[]'),
    excludeTags: JSON.parse(row.exclude_tags || '[]'),
    sort: row.sort || null,
    createdAt: row.created_at,
  };
}

export function listViews() {
  return stmt('SELECT * FROM saved_views ORDER BY name COLLATE NOCASE')
    .all()
    .map(serialize);
}

export function getView(id) {
  return serialize(stmt('SELECT * FROM saved_views WHERE id = ?').get(id));
}

export function createView({ name, query, includeTags, excludeTags, sort }) {
  const info = stmt(
      `INSERT INTO saved_views (name, query, include_tags, exclude_tags, sort, created_at)
       VALUES (@name, @query, @includeTags, @excludeTags, @sort, @createdAt)`
    )
    .run({
      name,
      query: query || '',
      includeTags: JSON.stringify(includeTags || []),
      excludeTags: JSON.stringify(excludeTags || []),
      sort: sort || null,
      createdAt: new Date().toISOString(),
    });
  return getView(info.lastInsertRowid);
}

export function updateView(id, fields) {
  const current = stmt('SELECT * FROM saved_views WHERE id = ?').get(id);
  if (!current) return null;
  const merged = {
    name: fields.name ?? current.name,
    query: fields.query ?? current.query,
    includeTags:
      fields.includeTags !== undefined
        ? JSON.stringify(fields.includeTags)
        : current.include_tags,
    excludeTags:
      fields.excludeTags !== undefined
        ? JSON.stringify(fields.excludeTags)
        : current.exclude_tags,
    sort: fields.sort !== undefined ? fields.sort : current.sort,
  };
  stmt(
    `UPDATE saved_views SET name=@name, query=@query, include_tags=@includeTags,
       exclude_tags=@excludeTags, sort=@sort WHERE id=@id`
  ).run({ ...merged, id });
  return getView(id);
}

export function deleteView(id) {
  stmt('DELETE FROM saved_views WHERE id = ?').run(id);
}
