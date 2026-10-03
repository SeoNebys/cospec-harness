import { Router } from 'express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import db from '../db/connection.js';
import { CAPTURES_DIR } from '../db/connection.js';
import * as Bookmarks from '../models/bookmark.js';
import { capturePage } from '../services/capture.js';
import { requestSnapshot } from '../services/archiveorg.js';

const router = Router();

// POST /api/bookmarks/:id/capture — self-contained HTML or preserved PDF
// (FR-023, FR-025).
router.post('/bookmarks/:id/capture', async (req, res) => {
  const id = Number(req.params.id);
  const raw = Bookmarks.getRawById(id);
  if (!raw) return res.status(404).json({ error: 'Bookmark not found.' });

  const result = await capturePage(id, raw.url);
  db.prepare(
    `INSERT INTO page_capture (bookmark_id, kind, file_path, captured_at, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, result.kind, result.filePath, new Date().toISOString(), result.status);

  if (result.status !== 'ready') {
    return res
      .status(200)
      .json({ capture: { kind: result.kind, status: result.status }, message: 'The copy could not be made; the bookmark is unchanged.' });
  }
  res.json({ capture: { kind: result.kind, status: result.status } });
});

// GET /api/bookmarks/:id/capture — serve the stored copy (FR-023).
router.get('/bookmarks/:id/capture', (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(`SELECT * FROM page_capture WHERE bookmark_id = ? AND status = 'ready' ORDER BY id DESC LIMIT 1`)
    .get(id);
  if (!row || !row.file_path) return res.status(404).json({ error: 'No saved copy for this bookmark.' });
  const path = join(CAPTURES_DIR, row.file_path);
  if (!existsSync(path)) return res.status(404).json({ error: 'Saved copy file is missing.' });
  res.type(row.kind === 'pdf' ? 'application/pdf' : 'text/html');
  res.sendFile(path);
});

// POST /api/bookmarks/:id/archiveorg — request an Internet Archive snapshot
// (FR-024, FR-025).
router.post('/bookmarks/:id/archiveorg', async (req, res) => {
  const id = Number(req.params.id);
  const raw = Bookmarks.getRawById(id);
  if (!raw) return res.status(404).json({ error: 'Bookmark not found.' });

  const result = await requestSnapshot(raw.url);
  db.prepare(
    `INSERT INTO archive_snapshot (bookmark_id, snapshot_url, requested_at, status)
     VALUES (?, ?, ?, ?)`
  ).run(id, result.snapshotUrl, new Date().toISOString(), result.status);

  const payload = { snapshot: { status: result.status, snapshotUrl: result.snapshotUrl } };
  if (result.status === 'failed') payload.message = 'The snapshot could not be made; the bookmark is unchanged.';
  res.status(result.status === 'failed' ? 200 : 202).json(payload);
});

export default router;
