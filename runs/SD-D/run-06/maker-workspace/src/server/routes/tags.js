import { Router } from 'express';
import { listTags, suggestTags } from '../db/tags.repo.js';

const router = Router();

// GET /api/tags — all tags with counts (FR-010)
router.get('/', (_req, res) => {
  res.json({ tags: listTags() });
});

// GET /api/tags/suggest?q= — type-ahead suggestions (FR-009)
router.get('/suggest', (req, res) => {
  res.json({ suggestions: suggestTags(req.query.q) });
});

export default router;
