import { Router } from 'express';
import { listTagsWithCounts, suggestTags } from '../models/tag.js';

const router = Router();

// GET /api/tags — all tags with counts (FR-012).
router.get('/tags', (req, res) => {
  res.json({ tags: listTagsWithCounts() });
});

// GET /api/tags/suggest?prefix= — autocomplete existing tags (FR-012).
router.get('/tags/suggest', (req, res) => {
  res.json({ tags: suggestTags(req.query.prefix) });
});

export default router;
