import express from 'express';
import { listTags, suggestTags } from '../services/tags.js';

export const tagsRouter = express.Router();

// GET /api/tags — all tags with counts
tagsRouter.get('/', (req, res) => {
  res.json({ tags: listTags() });
});

// GET /api/tags/suggest?prefix= — existing tags matching the prefix
tagsRouter.get('/suggest', (req, res) => {
  res.json({ suggestions: suggestTags(req.query.prefix || '') });
});
