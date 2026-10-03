import express from 'express';
import { db } from '../db/db.js';
import { parseQuery, QueryError } from '../lib/queryParser.js';

export const router = express.Router();

function shape(row) {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    include_tags: JSON.parse(row.include_tags || '[]'),
    exclude_tags: JSON.parse(row.exclude_tags || '[]'),
    created_at: row.created_at
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM saved_searches ORDER BY lower(name)').all();
  res.json({ saved_searches: rows.map(shape) });
});

router.post('/', (req, res) => {
  const { name, query, include_tags, exclude_tags } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: { code: 'invalid', message: 'Name is required' } });
  if (query && query.trim()) {
    try { parseQuery(query); } catch (e) {
      if (e instanceof QueryError) return res.status(400).json({ error: { code: 'bad_query', message: e.message } });
      throw e;
    }
  }
  const info = db.prepare(
    'INSERT INTO saved_searches (name, query, include_tags, exclude_tags, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), query || '', JSON.stringify(include_tags || []), JSON.stringify(exclude_tags || []), Date.now());
  res.status(201).json({ saved_search: shape(db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(info.lastInsertRowid)) });
});

router.patch('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Saved search not found' } });
  const { name, query, include_tags, exclude_tags } = req.body || {};
  if (query !== undefined && query.trim()) {
    try { parseQuery(query); } catch (e) {
      if (e instanceof QueryError) return res.status(400).json({ error: { code: 'bad_query', message: e.message } });
      throw e;
    }
  }
  db.prepare(
    `UPDATE saved_searches SET name = ?, query = ?, include_tags = ?, exclude_tags = ? WHERE id = ?`
  ).run(
    name !== undefined ? name.trim() : row.name,
    query !== undefined ? query : row.query,
    include_tags !== undefined ? JSON.stringify(include_tags) : row.include_tags,
    exclude_tags !== undefined ? JSON.stringify(exclude_tags) : row.exclude_tags,
    row.id
  );
  res.json({ saved_search: shape(db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(row.id)) });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM saved_searches WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Saved search not found' } });
  res.json({ deleted: true });
});
