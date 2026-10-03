import express from 'express';
import { listTags, suggestTags } from '../models/tag.js';

const router = express.Router();

// GET /api/tags — all tags with counts
router.get('/', (req, res) => {
  res.json({ tags: listTags() });
});

// GET /api/tags/suggest?q= — suggestions while typing (FR-012)
router.get('/suggest', (req, res) => {
  res.json({ tags: suggestTags(req.query.q || '') });
});

export default router;
