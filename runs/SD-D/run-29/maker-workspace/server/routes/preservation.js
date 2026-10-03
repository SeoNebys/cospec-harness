import express from 'express';
import { db } from '../db.js';
import { getBookmarkRow, getBookmark } from '../repo.js';
import { preserveToArchive } from '../services/archive.js';

export const router = express.Router();

const setIaStmt = db.prepare('UPDATE bookmarks SET ia_status=?, ia_snapshot_url=? WHERE id=?');

// POST /api/bookmarks/:id/preserve — manual Internet Archive preservation
router.post('/:id(\\d+)/preserve', (req, res) => {
  const id = Number(req.params.id);
  const row = getBookmarkRow(id);
  if (!row) return res.status(404).json({ error: 'Bookmark not found.' });

  setIaStmt.run('pending', null, id);
  // Fire-and-forget; never blocks. Updates status when done.
  preserveToArchive(row.normalized_url)
    .then((r) => setIaStmt.run(r.ia_status, r.ia_snapshot_url, id))
    .catch(() => setIaStmt.run('failed', null, id));

  res.status(202).json({ id, ia_status: 'pending' });
});

// GET /api/bookmarks/:id/preserve — poll IA status
router.get('/:id(\\d+)/preserve', (req, res) => {
  const bm = getBookmark(Number(req.params.id));
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json({ id: bm.id, ia_status: bm.ia_status, ia_snapshot_url: bm.ia_snapshot_url });
});
