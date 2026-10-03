import express from 'express';
import { candidatesForSearch } from '../services/bookmarks.js';
import { parse } from '../services/searchParser.js';
import { evaluate } from '../services/searchEvaluator.js';

export const searchRouter = express.Router();

function comparator(sort) {
  switch (sort) {
    case 'oldest':
      return (a, b) => a.dateAdded.localeCompare(b.dateAdded);
    case 'title':
      return (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    case 'updated':
      return (a, b) => b.dateUpdated.localeCompare(a.dateUpdated);
    case 'newest':
    default:
      return (a, b) => b.dateAdded.localeCompare(a.dateAdded);
  }
}

// GET /api/search?q=...&sort=...&view=normal|unread
searchRouter.get('/', (req, res, next) => {
  try {
    const { q = '', sort = 'newest', view = 'normal', limit, offset } = req.query;
    const searchView = view === 'unread' ? 'unread' : 'normal'; // never search archived
    const ast = parse(q); // throws 400 on malformed query
    let matches = candidatesForSearch({ view: searchView }).filter((b) => evaluate(ast, b));
    matches.sort(comparator(sort));
    const matchedIds = matches.map((b) => b.id);
    const total = matches.length;
    if (offset != null || limit != null) {
      const off = offset != null ? Number(offset) : 0;
      const lim = limit != null ? Number(limit) : matches.length;
      matches = matches.slice(off, off + lim);
    }
    res.json({ items: matches, total, matchedIds });
  } catch (err) {
    next(err);
  }
});
