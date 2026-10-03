import { Router } from 'express';
import multer from 'multer';
import { parseNetscape, serializeNetscape } from '../services/netscape.js';
import { getByNormalizedUrl, insertBookmark, listForView } from '../services/bookmarks.js';
import { normalize, isValidWebUrl } from '../services/urlNormalize.js';

const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB cap

export function importExportRouter() {
  const router = Router();

  router.post('/import', upload.single('file'), (req, res) => {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No bookmarks file uploaded' });
    }
    const html = req.file.buffer.toString('utf8');
    let entries;
    try {
      entries = parseNetscape(html);
    } catch {
      return res.status(400).json({ error: 'Could not parse the bookmarks file' });
    }
    if (!entries.length) {
      return res.status(400).json({ error: 'No bookmarks found in the file' });
    }

    let added = 0;
    let skipped = 0;
    for (const entry of entries) {
      if (!isValidWebUrl(entry.url)) {
        skipped += 1;
        continue;
      }
      const normalizedUrl = normalize(entry.url);
      if (getByNormalizedUrl(normalizedUrl)) {
        skipped += 1;
        continue;
      }
      insertBookmark({
        url: entry.url,
        normalizedUrl,
        title: entry.title,
        tags: entry.tags,
        dateAdded: entry.dateAdded,
        // Imported items get a snapshot attempt too, but don't block import.
        snapshotStatus: 'pending',
        metadataStatus: 'collected',
      });
      added += 1;
    }
    return res.json({ added, skipped });
  });

  router.get('/export', (_req, res) => {
    // Export the whole collection (normal + archived) to preserve everything.
    const all = [...listForView('all'), ...listForView('archived')];
    const html = serializeNetscape(all);
    res.type('text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
    res.send(html);
  });

  return router;
}
