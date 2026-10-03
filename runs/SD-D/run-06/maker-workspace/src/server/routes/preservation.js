import { Router } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getById, serialize } from '../db/bookmarks.repo.js';
import { preserveLocal } from '../services/preserve.js';
import { submitToArchiveOrg } from '../services/archiveOrg.js';

const router = Router();

// POST /api/bookmarks/:id/preserve/local — (re)generate the local copy (FR-026/027)
router.post('/:id/preserve/local', (req, res) => {
  const id = Number(req.params.id);
  const row = getById(id);
  if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  preserveLocal(id, row.url).catch(() => {}); // async, non-blocking (FR-029)
  res.status(202).json({ preserved: { status: 'pending' } });
});

// GET /api/bookmarks/:id/preserve/local/file — serve the preserved copy
router.get('/:id/preserve/local/file', (req, res) => {
  const id = Number(req.params.id);
  const row = getById(id);
  if (!row || row.preserved_status !== 'ready' || !row.preserved_path || !existsSync(row.preserved_path)) {
    return res.status(404).json({ error: { code: 'not_ready', message: 'No preserved copy available' } });
  }
  const type = row.preserved_kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8';
  res.type(type);
  res.sendFile(resolve(row.preserved_path));
});

// POST /api/bookmarks/:id/preserve/archive-org — submit to Internet Archive (FR-028/029)
router.post('/:id/preserve/archive-org', (req, res) => {
  const id = Number(req.params.id);
  const row = getById(id);
  if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  submitToArchiveOrg(id, row.url).catch(() => {}); // async, non-blocking
  res.status(202).json({ archiveOrg: { status: 'pending' } });
});

// GET /api/bookmarks/:id/preserve/status — convenience polling for the client
router.get('/:id/preserve/status', (req, res) => {
  const row = getById(Number(req.params.id));
  if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  const b = serialize(row);
  res.json({ preserved: b.preserved, archiveOrg: b.archiveOrg, metadataStatus: b.metadataStatus });
});

export default router;
