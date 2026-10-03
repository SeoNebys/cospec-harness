import express from 'express';
import multer from 'multer';
import { parseNetscape, generateNetscape, InvalidBookmarkFileError } from '../services/netscape.js';
import { normalizeUrl, InvalidUrlError } from '../services/url.js';
import { getByUrlKey } from '../models/bookmark.js';
import { setBookmarkTags, getBookmarkTagNames } from '../models/tag.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20_000_000 } });

export function importExportRouter(db) {
  const router = express.Router();

  // Import a Netscape bookmark file (US8). Whole-file reject on malformed input.
  router.post('/import', upload.single('file'), (req, res) => {
    const content = req.file ? req.file.buffer.toString('utf8') : req.body && req.body.content;
    if (!content) {
      return res.status(400).json({ error: { code: 'validation', message: 'No file provided.' } });
    }
    let entries;
    try {
      entries = parseNetscape(content);
    } catch (err) {
      if (err instanceof InvalidBookmarkFileError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }

    const run = db.transaction(() => {
      let imported = 0;
      let skipped = 0;
      const insert = db.prepare(
        `INSERT INTO bookmark
         (url, url_key, title, title_user_set, description, description_user_set,
          note_md, read_state, archived, metadata_status, date_added, date_updated)
         VALUES (?, ?, ?, 1, NULL, 0, NULL, 'unread', 0, 'complete', ?, ?)`
      );
      for (const e of entries) {
        let norm;
        try {
          norm = normalizeUrl(e.url);
        } catch (err) {
          if (err instanceof InvalidUrlError) {
            skipped++;
            continue;
          }
          throw err;
        }
        if (getByUrlKey(db, norm.urlKey)) {
          skipped++;
          continue;
        }
        const dateAdded = e.dateAdded || new Date().toISOString();
        const info = insert.run(norm.url, norm.urlKey, e.title || norm.url, dateAdded, dateAdded);
        if (e.tags && e.tags.length) setBookmarkTags(db, info.lastInsertRowid, e.tags);
        imported++;
      }
      return { imported, skipped };
    });
    const result = run();
    res.json(result);
  });

  // Export the collection as a Netscape bookmark file (US8).
  router.get('/export', (req, res) => {
    const rows = db.prepare('SELECT * FROM bookmark ORDER BY date_added ASC').all();
    const enriched = rows.map((r) => ({
      url: r.url,
      title: r.title,
      date_added: r.date_added,
      tags: getBookmarkTagNames(db, r.id),
    }));
    const file = generateNetscape(enriched);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
    res.send(file);
  });

  return router;
}
