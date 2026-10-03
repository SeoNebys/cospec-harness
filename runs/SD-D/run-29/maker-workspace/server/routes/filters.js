import express from 'express';
import { db } from '../db.js';
import { ValidationError } from '../services/url.js';

export const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    include_tags: JSON.parse(row.include_tags || '[]'),
    exclude_tags: JSON.parse(row.exclude_tags || '[]'),
    created_date: row.created_date,
  };
}

const listStmt = db.prepare('SELECT * FROM saved_filters ORDER BY name COLLATE NOCASE');
const getStmt = db.prepare('SELECT * FROM saved_filters WHERE id = ?');
const insertStmt = db.prepare(`
  INSERT INTO saved_filters (name, query, include_tags, exclude_tags, created_date)
  VALUES (@name, @query, @include_tags, @exclude_tags, @created_date)
`);
const updateStmt = db.prepare(`
  UPDATE saved_filters SET name=@name, query=@query, include_tags=@include_tags,
    exclude_tags=@exclude_tags WHERE id=@id
`);
const deleteStmt = db.prepare('DELETE FROM saved_filters WHERE id = ?');

router.get('/', (_req, res) => {
  res.json(listStmt.all().map(serialize));
});

router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) throw new ValidationError('A filter name is required.');
  const info = insertStmt.run({
    name: String(b.name).trim(),
    query: b.query ? String(b.query) : '',
    include_tags: JSON.stringify(b.include_tags || []),
    exclude_tags: JSON.stringify(b.exclude_tags || []),
    created_date: Date.now(),
  });
  res.status(201).json(serialize(getStmt.get(info.lastInsertRowid)));
});

router.patch('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const row = getStmt.get(id);
  if (!row) return res.status(404).json({ error: 'Filter not found.' });
  const b = req.body || {};
  updateStmt.run({
    id,
    name: b.name !== undefined ? String(b.name).trim() : row.name,
    query: b.query !== undefined ? String(b.query) : row.query,
    include_tags: b.include_tags !== undefined ? JSON.stringify(b.include_tags) : row.include_tags,
    exclude_tags: b.exclude_tags !== undefined ? JSON.stringify(b.exclude_tags) : row.exclude_tags,
  });
  res.json(serialize(getStmt.get(id)));
});

router.delete('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  if (!getStmt.get(id)) return res.status(404).json({ error: 'Filter not found.' });
  deleteStmt.run(id);
  res.status(204).end();
});
