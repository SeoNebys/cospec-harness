// Saved searches: named, reusable queries with included/excluded tags (FR-029/030).
import { getDb } from '../db/connection.js';
import { candidatesForSearch } from './bookmarks.js';
import { parse } from './searchParser.js';
import { evaluate } from './searchEvaluator.js';

function rowToSaved(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    queryText: row.query_text || '',
    includedTags: JSON.parse(row.included_tags || '[]'),
    excludedTags: JSON.parse(row.excluded_tags || '[]'),
    dateCreated: row.date_created,
  };
}

export function listSavedSearches() {
  const db = getDb();
  return db.prepare('SELECT * FROM saved_searches ORDER BY name COLLATE NOCASE').all().map(rowToSaved);
}

export function getSavedSearch(id) {
  const db = getDb();
  return rowToSaved(db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id));
}

function validateName(name) {
  const clean = String(name || '').trim();
  if (!clean) {
    const e = new Error('A name is required.');
    e.status = 400;
    e.code = 'name_required';
    throw e;
  }
  return clean;
}

export function createSavedSearch(input) {
  const db = getDb();
  const name = validateName(input.name);
  const info = db
    .prepare('INSERT INTO saved_searches (name, query_text, included_tags, excluded_tags, date_created) VALUES (?, ?, ?, ?, ?)')
    .run(name, input.queryText || '', JSON.stringify(input.includedTags || []), JSON.stringify(input.excludedTags || []), new Date().toISOString());
  return getSavedSearch(Number(info.lastInsertRowid));
}

export function updateSavedSearch(id, input) {
  const db = getDb();
  const existing = getSavedSearch(id);
  if (!existing) {
    const e = new Error('Saved search not found.');
    e.status = 404;
    e.code = 'not_found';
    throw e;
  }
  const name = input.name !== undefined ? validateName(input.name) : existing.name;
  db.prepare('UPDATE saved_searches SET name = ?, query_text = ?, included_tags = ?, excluded_tags = ? WHERE id = ?').run(
    name,
    input.queryText !== undefined ? input.queryText : existing.queryText,
    JSON.stringify(input.includedTags !== undefined ? input.includedTags : existing.includedTags),
    JSON.stringify(input.excludedTags !== undefined ? input.excludedTags : existing.excludedTags),
    id
  );
  return getSavedSearch(id);
}

export function deleteSavedSearch(id) {
  const db = getDb();
  return db.prepare('DELETE FROM saved_searches WHERE id = ?').run(id).changes > 0;
}

// Run a saved search: apply query text, then require includedTags and exclude excludedTags.
export function runSavedSearch(id) {
  const saved = getSavedSearch(id);
  if (!saved) {
    const e = new Error('Saved search not found.');
    e.status = 404;
    e.code = 'not_found';
    throw e;
  }
  const ast = parse(saved.queryText || '');
  const included = saved.includedTags.map((t) => t.toLowerCase());
  const excluded = saved.excludedTags.map((t) => t.toLowerCase());
  const items = candidatesForSearch({ view: 'normal' })
    .filter((b) => evaluate(ast, b))
    .filter((b) => {
      const tags = (b.tags || []).map((t) => t.toLowerCase());
      const hasAllIncluded = included.every((t) => tags.includes(t));
      const hasNoExcluded = excluded.every((t) => !tags.includes(t));
      return hasAllIncluded && hasNoExcluded;
    });
  return { items, total: items.length, matchedIds: items.map((b) => b.id) };
}
