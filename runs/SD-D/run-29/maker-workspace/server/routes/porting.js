import express from 'express';
import { db, transaction } from '../db.js';
import { normalize } from '../services/url.js';
import { parse as parseNetscape, serialize as serializeNetscape } from '../services/netscape.js';
import { findByNormalized, setTags, bookmarkTags } from '../repo.js';

export const router = express.Router();

// Accept the uploaded bookmark file as a raw HTML/text body.
const rawHtml = express.text({ type: ['text/html', 'text/plain', 'application/octet-stream'], limit: '25mb' });

const insertStmt = db.prepare(`
  INSERT INTO bookmarks (url, normalized_url, title, description, saved_date, updated_date, offline_status)
  VALUES (@url, @normalized_url, @title, '', @saved_date, @updated_date, 'pending')
`);

// POST /api/import — import Netscape bookmark HTML
router.post('/import', rawHtml, (req, res) => {
  const html = typeof req.body === 'string' ? req.body : '';
  const { entries, skipped } = parseNetscape(html);
  let imported = 0;
  let duplicates = 0;
  let invalid = skipped;

  const run = transaction(() => {
    for (const e of entries) {
      let normalized;
      try { normalized = normalize(e.url); } catch { invalid++; continue; }
      if (findByNormalized(normalized)) { duplicates++; continue; }
      const info = insertStmt.run({
        url: e.url,
        normalized_url: normalized,
        title: e.title,
        saved_date: e.savedDate,
        updated_date: Date.now(),
      });
      if (e.tags && e.tags.length) setTags(info.lastInsertRowid, e.tags);
      imported++;
    }
  });
  run();

  res.json({ imported, skipped: invalid, duplicates });
});

// GET /api/export — export all bookmarks as Netscape HTML
router.get('/export', (_req, res) => {
  const rows = db.prepare('SELECT id, url, title, saved_date FROM bookmarks ORDER BY saved_date').all();
  const bookmarks = rows.map((r) => ({
    url: r.url,
    title: r.title,
    tags: bookmarkTags(r.id),
    savedDate: r.saved_date,
  }));
  const html = serializeNetscape(bookmarks);
  res.type('text/html');
  res.set('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(html);
});
