import { Router } from 'express';
import { parseNetscape, generateNetscape } from '../services/netscape.js';
import { normalizeAndValidateUrl } from '../services/urlValidate.js';
import * as Bookmarks from '../models/bookmark.js';
import { listRaw, serialize } from '../models/bookmark.js';

const router = Router();

// POST /api/import — import a Netscape bookmark file (FR-021).
// Accepts { html } (the file contents). Folders become tags; existing URLs skipped.
router.post('/import', (req, res) => {
  const html = req.body?.html;
  if (!html || !String(html).trim()) {
    return res.status(400).json({ error: 'No bookmark file content was provided.' });
  }
  let entries;
  try {
    entries = parseNetscape(html);
  } catch {
    return res.status(400).json({ error: 'The bookmark file could not be read.' });
  }
  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    const check = normalizeAndValidateUrl(entry.url);
    if (!check.ok) {
      skipped++;
      continue;
    }
    if (Bookmarks.getRawByUrl(check.url)) {
      skipped++;
      continue;
    }
    Bookmarks.create({ url: check.url, title: entry.title, tags: entry.tags });
    added++;
  }
  res.json({ added, skipped });
});

// GET /api/export — export all bookmarks as a Netscape file (FR-022).
router.get('/export', (req, res) => {
  const all = listRaw({ view: 'all' }).map(serialize);
  const html = generateNetscape(all);
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.type('text/html').send(html);
});

export default router;
