import { Router } from 'express';
import { listTags } from '../models/tag.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ tags: listTags(req.query.prefix || '') });
});

export default router;
