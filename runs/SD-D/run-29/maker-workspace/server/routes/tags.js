import express from 'express';
import { listTags, suggestTags } from '../repo.js';

export const router = express.Router();

// GET /api/tags — all tags with counts
router.get('/', (_req, res) => {
  res.json(listTags());
});

// GET /api/tags/suggest?q=<prefix> — type-ahead suggestions
router.get('/suggest', (req, res) => {
  res.json(suggestTags(req.query.q || ''));
});
