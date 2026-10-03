import express from 'express';
import multer from 'multer';
import { db } from '../db/db.js';
import { canonicalKey, isValidHttpUrl, titleFromUrl } from '../lib/urlNormalize.js';
import { parseNetscape, serializeNetscape } from '../lib/netscape.js';
import { getBookmarkTags, setBookmarkTags } from './tags.js';

export const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/import  (multipart file field: "file")
router.post('/', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { code: 'no_file', message: 'A bookmark HTML file is required' } });
    const html = req.file.buffer.toString('utf8');
    const entries = parseNetscape(html);
    let added = 0, skipped_duplicates = 0, failed = 0;
    const details = [];

    const run = db.transaction(() => {
      for (const e of entries) {
        if (!isValidHttpUrl(e.url)) { failed++; details.push({ url: e.url, reason: 'invalid_url' }); continue; }
        let key;
        try { key = canonicalKey(e.url); } catch { failed++; details.push({ url: e.url, reason: 'invalid_url' }); continue; }
        const existing = db.prepare('SELECT id FROM bookmarks WHERE url_key = ?').get(key);
        if (existing) { skipped_duplicates++; continue; }
        const createdAt = e.addDate ? e.addDate * 1000 : Date.now();
        const info = db.prepare(
          `INSERT INTO bookmarks (url, url_key, title, description, note, created_at, updated_at, metadata_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'partial')`
        ).run(e.url.trim(), key, e.title || titleFromUrl(e.url), null, null, createdAt, createdAt);
        if (e.tags && e.tags.length) setBookmarkTags(info.lastInsertRowid, e.tags);
        added++;
      }
    });
    run();
    res.json({ added, skipped_duplicates, failed, details });
  } catch (err) {
    next(err);
  }
});

// GET /api/export  -> Netscape bookmark HTML download
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at').all();
  const bookmarks = rows.map(r => ({ url: r.url, title: r.title, created_at: r.created_at, tags: getBookmarkTags(r.id) }));
  const html = serializeNetscape(bookmarks);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(html);
});
