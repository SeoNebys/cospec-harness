// Serve stored snapshots with the correct content type (contracts/api.md).
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { asyncHandler, HttpError } from '../util/errors.js';
import { getRaw } from '../models/bookmark.js';
import { SNAPSHOT_DIR } from '../db.js';

const router = express.Router();

router.get(
  '/:id/snapshot',
  asyncHandler(async (req, res) => {
    const row = getRaw(Number(req.params.id));
    if (!row) throw new HttpError(404, 'Bookmark not found.');
    if (!row.snapshot_available || !row.snapshot_path) {
      throw new HttpError(404, 'No snapshot available for this bookmark.');
    }
    const file = path.join(SNAPSHOT_DIR, row.snapshot_path);
    if (!fs.existsSync(file)) throw new HttpError(404, 'Snapshot file missing.');

    if (row.snapshot_type === 'pdf') {
      res.type('application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    } else {
      // MHTML: served so the browser renders the archived static page.
      res.type('multipart/related');
    }
    fs.createReadStream(file).pipe(res);
  })
);

export default router;
