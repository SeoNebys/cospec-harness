import { Router } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getById, setBookmarkFields } from '../models/bookmark.js';
import { preservePage, submitToArchiveOrg } from '../services/preservation.js';

const router = Router();

// Create a self-contained HTML copy, or store the original PDF (FR-032/033).
router.post('/:id/preserve', async (req, res) => {
  const id = Number(req.params.id);
  const bookmark = getById(id);
  if (!bookmark) return res.status(404).json({ error: { code: 'not-found', message: 'Bookmark not found' } });
  try {
    const result = await preservePage(id, bookmark.url);
    const fields = {};
    if (result.preservedHtmlPath) fields.preserved_html_path = result.preservedHtmlPath;
    if (result.preservedPdfPath) fields.preserved_pdf_path = result.preservedPdfPath;
    setBookmarkFields(id, fields);
    res.json({ ...result, status: 'ok' });
  } catch (err) {
    // Fail-soft: bookmark unaffected (FR-035).
    res.status(502).json({ error: { code: 'preserve-failed', message: err.message }, status: 'failed' });
  }
});

// Submit to the Internet Archive and store the snapshot link (FR-034).
router.post('/:id/archive-org', async (req, res) => {
  const id = Number(req.params.id);
  const bookmark = getById(id);
  if (!bookmark) return res.status(404).json({ error: { code: 'not-found', message: 'Bookmark not found' } });
  try {
    const archiveOrgUrl = await submitToArchiveOrg(bookmark.url);
    setBookmarkFields(id, { archive_org_url: archiveOrgUrl });
    res.json({ archiveOrgUrl });
  } catch (err) {
    res.status(502).json({ error: { code: 'archive-org-failed', message: err.message }, status: 'failed' });
  }
});

// Serve the preserved copy for offline viewing.
router.get('/:id/preserved', (req, res) => {
  const bookmark = getById(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: { code: 'not-found', message: 'Bookmark not found' } });
  const path = bookmark.preservedPdfPath || bookmark.preservedHtmlPath;
  if (!path || !existsSync(path)) return res.status(404).json({ error: { code: 'no-copy', message: 'No preserved copy' } });
  res.sendFile(resolve(path));
});

export default router;
