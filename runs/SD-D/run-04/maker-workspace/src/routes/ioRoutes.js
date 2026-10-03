import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, dataDirFor } from '../db/index.js';
import { getById } from '../models/bookmark.js';
import { parseNetscape, importEntries, exportNetscape } from '../services/importExport.js';
import { preserveLocal, preserveArchiveOrg, PreserveError } from '../services/preserve.js';

const router = express.Router();

function apiError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// POST /api/import — Netscape bookmark HTML (FR-035/036).
// Accepts the file content as the raw request body (text/html) or JSON {html}.
router.post('/import', express.text({ type: ['text/html', 'text/plain'], limit: '25mb' }), (req, res) => {
  let html = '';
  if (typeof req.body === 'string') {
    html = req.body;
  } else if (req.body && typeof req.body.html === 'string') {
    html = req.body.html;
  }
  if (!html.trim()) {
    return apiError(res, 400, 'empty_import', 'No bookmark file content received.');
  }
  const entries = parseNetscape(html);
  const summary = importEntries(entries);
  res.json(summary);
});

// GET /api/export — Netscape bookmark HTML (FR-037)
router.get('/export', (req, res) => {
  const html = exportNetscape();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(html);
});

// POST /api/bookmarks/:id/preserve (FR-031/032/033/034)
router.post('/bookmarks/:id/preserve', async (req, res) => {
  const bookmark = getById(parseInt(req.params.id, 10));
  if (!bookmark) return apiError(res, 404, 'not_found', 'Bookmark not found.');
  const mode = (req.body && req.body.mode) || 'local';
  try {
    let result;
    if (mode === 'archive_org') {
      result = await preserveArchiveOrg(bookmark);
    } else {
      result = await preserveLocal(bookmark);
    }
    const db = getDb();
    const info = db
      .prepare(
        'INSERT INTO preserved_copies (bookmark_id, kind, location, captured_at) VALUES (?, ?, ?, ?)'
      )
      .run(bookmark.id, result.kind, result.location, new Date().toISOString());
    res.json({
      preserved: {
        id: info.lastInsertRowid,
        kind: result.kind,
        location: result.location,
        captured_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof PreserveError) {
      return apiError(res, 502, 'preserve_failed', err.message);
    }
    throw err;
  }
});

// GET /api/bookmarks/:id/preserved/:copyId — serve a stored local copy
router.get('/bookmarks/:id/preserved/:copyId', (req, res) => {
  const db = getDb();
  const copy = db
    .prepare('SELECT * FROM preserved_copies WHERE id = ? AND bookmark_id = ?')
    .get(parseInt(req.params.copyId, 10), parseInt(req.params.id, 10));
  if (!copy) return apiError(res, 404, 'not_found', 'Preserved copy not found.');
  if (copy.kind === 'archive_org') {
    return res.redirect(copy.location);
  }
  const abs = path.join(dataDirFor(), copy.location);
  if (!fs.existsSync(abs)) return apiError(res, 404, 'not_found', 'Preserved file missing.');
  res.setHeader(
    'Content-Type',
    copy.kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8'
  );
  fs.createReadStream(abs).pipe(res);
});

export default router;
