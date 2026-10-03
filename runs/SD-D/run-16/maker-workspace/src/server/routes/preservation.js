import express from 'express';
import { preserveOfflineCopy, preserveToInternetArchive, readPreservedFile } from '../services/preservation.js';

export const preservationRouter = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/bookmarks/:id/preserve — offline copy (single HTML or original PDF)
preservationRouter.post(
  '/:id/preserve',
  asyncHandler(async (req, res) => {
    const bookmark = await preserveOfflineCopy(Number(req.params.id));
    res.json({ bookmark });
  })
);

// GET /api/bookmarks/:id/preserved — serve the stored copy
preservationRouter.get('/:id/preserved', (req, res) => {
  const file = readPreservedFile(Number(req.params.id));
  if (!file) return res.status(404).json({ error: { code: 'not_found', message: 'No preserved copy for this bookmark.' } });
  res.setHeader('Content-Type', file.contentType);
  return res.sendFile(file.path);
});

// POST /api/bookmarks/:id/archive-org — Internet Archive snapshot
preservationRouter.post(
  '/:id/archive-org',
  asyncHandler(async (req, res) => {
    const bookmark = await preserveToInternetArchive(Number(req.params.id));
    res.json({ bookmark });
  })
);
