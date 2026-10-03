// /api/import and /api/export — Netscape bookmark HTML (contracts/api.md).
import express from 'express';
import { asyncHandler, HttpError } from '../util/errors.js';
import { parseNetscape, generateNetscape } from '../services/porting.js';
import { isValidWebUrl } from '../util/url.js';
import * as Bookmark from '../models/bookmark.js';

const router = express.Router();

// Import: the client uploads the file contents as a text/html body.
router.post(
  '/import',
  express.text({ type: ['text/html', 'text/plain', 'application/octet-stream'], limit: '25mb' }),
  asyncHandler(async (req, res) => {
    const html = typeof req.body === 'string' ? req.body : '';
    if (!html.trim()) throw new HttpError(400, 'No bookmark file content received.');

    const entries = parseNetscape(html);
    let imported = 0;
    let skippedDuplicates = 0;
    let invalid = 0;

    for (const entry of entries) {
      if (!isValidWebUrl(entry.address)) {
        invalid += 1;
        continue;
      }
      if (Bookmark.findByNormalized(entry.address)) {
        skippedDuplicates += 1;
        continue;
      }
      // Import records metadata as given; snapshots/details are not fetched in bulk.
      Bookmark.create(
        { address: entry.address, title: entry.title, tags: entry.tags },
        {}
      );
      imported += 1;
    }

    res.json({ imported, skippedDuplicates, invalid });
  })
);

// Export: the current collection (active + archived) as a Netscape HTML file.
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const active = Bookmark.list({ view: 'all', sort: 'created', order: 'asc' });
    const archived = Bookmark.list({ view: 'archive', sort: 'created', order: 'asc' });
    const html = generateNetscape([...active, ...archived]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
    res.send(html);
  })
);

export default router;
