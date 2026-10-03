import express from 'express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { db, dataDir } from '../db/db.js';
import { preserveLocal } from '../lib/capture.js';
import { submitToArchiveOrg } from '../lib/archiveOrg.js';

export const router = express.Router();

// POST /api/bookmarks/:id/preserve  { local?: true, archive_org?: false }
router.post('/:id/preserve', async (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
    const { local = true, archive_org = false } = req.body || {};
    const results = [];
    const errors = [];

    if (local) {
      try {
        const destDir = join(dataDir, 'preserved', String(row.id));
        const { kind, filePath } = await preserveLocal(row.url, destDir);
        const info = db.prepare(
          'INSERT INTO preserved_copies (bookmark_id, kind, file_path, created_at) VALUES (?, ?, ?, ?)'
        ).run(row.id, kind, filePath, Date.now());
        results.push(db.prepare('SELECT * FROM preserved_copies WHERE id = ?').get(info.lastInsertRowid));
      } catch (e) {
        errors.push({ target: 'local', message: 'Local preservation failed: ' + e.message });
      }
    }

    if (archive_org) {
      const r = await submitToArchiveOrg(row.url);
      const info = db.prepare(
        'INSERT INTO preserved_copies (bookmark_id, kind, created_at, archive_org_url, archive_org_status) VALUES (?, ?, ?, ?, ?)'
      ).run(row.id, 'html', Date.now(), r.archive_org_url, r.status);
      results.push(db.prepare('SELECT * FROM preserved_copies WHERE id = ?').get(info.lastInsertRowid));
      if (r.status === 'failed') errors.push({ target: 'archive_org', message: 'Internet Archive submission failed' });
    }

    res.json({ preserved: results, errors });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookmarks/:id/preserved/:copyId  -> serve stored file
router.get('/:id/preserved/:copyId', (req, res) => {
  const copy = db.prepare('SELECT * FROM preserved_copies WHERE id = ? AND bookmark_id = ?').get(req.params.copyId, req.params.id);
  if (!copy || !copy.file_path || !existsSync(copy.file_path)) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Preserved copy not found' } });
  }
  res.setHeader('Content-Type', copy.kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
  res.sendFile(copy.file_path);
});
