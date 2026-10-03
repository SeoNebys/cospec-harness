// Saved Search model (FR-029–031).
import { SORT_KEYS } from '../lib/viewQuery.js';

function nowIso() {
  return new Date().toISOString();
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    query_text: row.query_text || '',
    include_tags: JSON.parse(row.include_tags || '[]'),
    exclude_tags: JSON.parse(row.exclude_tags || '[]'),
    view_scope: row.view_scope,
    sort: row.sort,
    date_created: row.date_created,
  };
}

export function listSavedSearches(db) {
  return db
    .prepare('SELECT * FROM saved_search ORDER BY name COLLATE NOCASE')
    .all()
    .map(serialize);
}

export function getSavedSearch(db, id) {
  return serialize(db.prepare('SELECT * FROM saved_search WHERE id = ?').get(id));
}

function validate(fields) {
  if (fields.view_scope && !['normal', 'unread', 'archived'].includes(fields.view_scope)) {
    const e = new Error('view_scope must be normal, unread, or archived.');
    e.code = 'validation';
    throw e;
  }
  if (fields.sort && !SORT_KEYS.has(fields.sort)) {
    const e = new Error('Unsupported sort order.');
    e.code = 'validation';
    throw e;
  }
}

export function createSavedSearch(db, body) {
  const name = String(body.name || '').trim();
  if (!name) {
    const e = new Error('A saved search needs a name.');
    e.code = 'validation';
    throw e;
  }
  validate(body);
  try {
    const info = db
      .prepare(
        `INSERT INTO saved_search
         (name, query_text, include_tags, exclude_tags, view_scope, sort, date_created)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        body.query_text || '',
        JSON.stringify(body.include_tags || []),
        JSON.stringify(body.exclude_tags || []),
        body.view_scope || 'normal',
        body.sort || 'date_added_desc',
        nowIso()
      );
    return getSavedSearch(db, info.lastInsertRowid);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      const e = new Error('A saved search with that name already exists.');
      e.code = 'validation';
      throw e;
    }
    throw err;
  }
}

export function updateSavedSearch(db, id, body) {
  const row = db.prepare('SELECT * FROM saved_search WHERE id = ?').get(id);
  if (!row) return null;
  validate(body);
  const sets = [];
  const vals = [];
  const map = {
    name: (v) => String(v).trim(),
    query_text: (v) => String(v || ''),
    include_tags: (v) => JSON.stringify(v || []),
    exclude_tags: (v) => JSON.stringify(v || []),
    view_scope: (v) => v,
    sort: (v) => v,
  };
  for (const [key, fn] of Object.entries(map)) {
    if (body[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(fn(body[key]));
    }
  }
  if (sets.length === 0) return serialize(row);
  vals.push(id);
  try {
    db.prepare(`UPDATE saved_search SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      const e = new Error('A saved search with that name already exists.');
      e.code = 'validation';
      throw e;
    }
    throw err;
  }
  return getSavedSearch(db, id);
}

export function deleteSavedSearch(db, id) {
  return db.prepare('DELETE FROM saved_search WHERE id = ?').run(id).changes > 0;
}
