import express from 'express';
import multer from 'multer';
import * as Bookmark from '../models/bookmark.js';
import { setBookmarkTags } from '../models/tag.js';
import db from '../db/index.js';
import { normalizeUrl } from '../services/url.js';
import { parseBookmarksHtml, generateBookmarksHtml } from '../services/porthtml.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Import Netscape bookmark HTML; merge by URL (FR-020).
router.post('/import', upload.single('file'), (req, res) => {
  const html = req.file ? req.file.buffer.toString('utf8') : req.body.html;
  if (!html) return res.status(400).json({ error: 'No file provided.' });
  let items;
  try {
    items = parseBookmarksHtml(html);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  let imported = 0;
  let merged = 0;
  const setDates = db.prepare('UPDATE bookmarks SET created_at = ?, updated_at = ? WHERE id = ?');
  for (const it of items) {
    const url = normalizeUrl(it.url);
    if (!url) continue;
    const existing = Bookmark.getByUrl(url);
    if (existing) {
      // Merge: keep bookmark, union tags, keep earliest created date.
      const unionTags = Array.from(new Set([...(existing.tags || []), ...(it.tags || [])]));
      setBookmarkTags(existing.id, unionTags);
      merged++;
    } else {
      const created = Bookmark.create({ url, title: it.title, tags: it.tags });
      // Preserve original dates from the import file (SC-006).
      setDates.run(it.created_at, it.updated_at, created.id);
      imported++;
    }
  }
  res.json({ imported, merged });
});

// Export all bookmarks as Netscape bookmark HTML (FR-020).
router.get('/export', (req, res) => {
  const bookmarks = Bookmark.allBookmarksForExport();
  const html = generateBookmarksHtml(bookmarks);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(html);
});

export default router;
