import express from 'express';
import { listTags } from '../models/tag.js';

const router = express.Router();

// List tags or prefix suggestions (FR-014/FR-014a).
router.get('/', (req, res) => {
  res.json({ tags: listTags(req.query.q) });
});

export default router;
