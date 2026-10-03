import express from 'express';
import { listTags } from '../models/tag.js';

export function tagsRouter(db) {
  const router = express.Router();
  router.get('/', (req, res) => {
    const items = listTags(db, req.query.prefix);
    res.json({ items });
  });
  return router;
}
