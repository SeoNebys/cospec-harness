import express from 'express';
import { db } from '../db/db.js';
import { buildFilter } from './bookmarks.js';
import { QueryError } from '../lib/queryParser.js';
import { getBookmarkTags } from './tags.js';

export const router = express.Router();

const SORTS = {
  date_added: 'b.created_at DESC',
  title: 'lower(b.title) ASC',
  last_updated: 'b.updated_at DESC'
};

// GET /api/search  (explicit search endpoint; same shape as list)
router.get('/', (req, res, next) => {
  try {
    const { view = 'main', q, include_tags, exclude_tags } = req.query;
    const sort = SORTS[req.query.sort] || SORTS.date_added;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(req.query.page_size, 10) || 25));
    const { where, params } = buildFilter({ view, q, include_tags, exclude_tags });
    const total = db.prepare(`SELECT COUNT(*) AS c FROM bookmarks b WHERE ${where}`).get(...params).c;
    const rows = db
      .prepare(`SELECT b.* FROM bookmarks b WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize);
    res.json({
      items: rows.map(r => ({
        ...r,
        read_later: !!r.read_later,
        is_read: !!r.is_read,
        is_archived: !!r.is_archived,
        tags: getBookmarkTags(r.id)
      })),
      total, page, page_size: pageSize
    });
  } catch (err) {
    if (err instanceof QueryError) return res.status(400).json({ error: { code: 'bad_query', message: err.message } });
    next(err);
  }
});
