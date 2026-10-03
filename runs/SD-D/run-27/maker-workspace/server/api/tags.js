import express from 'express';
import { db } from '../db/db.js';

export const router = express.Router();

// Get-or-create a tag by name, reusing case-insensitive matches (FR-010a).
export function getOrCreateTag(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  const existing = db
    .prepare('SELECT id, name FROM tags WHERE lower(name) = lower(?)')
    .get(trimmed);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(trimmed);
  return { id: info.lastInsertRowid, name: trimmed };
}

// Replace a bookmark's tag set.
export function setBookmarkTags(bookmarkId, tagNames) {
  const names = Array.isArray(tagNames) ? tagNames : [];
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  for (const n of names) {
    const tag = getOrCreateTag(n);
    if (tag) insert.run(bookmarkId, tag.id);
  }
}

export function getBookmarkTags(bookmarkId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ? ORDER BY lower(t.name)`
    )
    .all(bookmarkId)
    .map(r => r.name);
}

// GET /api/tags?prefix= -> suggestions (FR-010)
router.get('/', (req, res) => {
  const prefix = (req.query.prefix || '').toString().trim();
  let rows;
  if (prefix) {
    rows = db
      .prepare('SELECT name FROM tags WHERE lower(name) LIKE lower(?) ORDER BY lower(name) LIMIT 20')
      .all(prefix + '%');
  } else {
    rows = db.prepare('SELECT name FROM tags ORDER BY lower(name) LIMIT 200').all();
  }
  res.json({ tags: rows.map(r => r.name) });
});
