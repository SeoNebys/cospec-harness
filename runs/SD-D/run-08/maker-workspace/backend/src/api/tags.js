import express from 'express';
import { listTags } from '../models/tags.js';

const router = express.Router();

// GET /api/tags?prefix=... — tag suggestions with usage counts (FR-021).
router.get('/', (req, res) => {
  const prefix = req.query.prefix ? String(req.query.prefix) : '';
  res.json(listTags(prefix));
});

export default router;
