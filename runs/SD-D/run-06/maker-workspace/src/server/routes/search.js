import { Router } from 'express';
import { runSearch, SearchSyntaxError } from '../services/search/index.js';

const router = Router();

// GET /api/search?q=&sort=&page=&pageSize= (FR-011–FR-014)
router.get('/', (req, res, next) => {
  try {
    const { q, sort, page, pageSize } = req.query;
    const result = runSearch({
      q: q || '',
      sort: sort || 'newest',
      page: page || 1,
      pageSize: pageSize || 25,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof SearchSyntaxError) {
      return res.status(400).json({ error: { code: 'bad_query', message: e.message } });
    }
    next(e);
  }
});

export default router;
