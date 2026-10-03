import { Router } from 'express';
import type { ImportService } from './import-service.js';
import type { ImportRepository } from './import-repository.js';
import type { BookmarkRepository } from '../bookmarks/bookmark-repository.js';
import { writeExport } from './export-writer.js';
import { AppError } from '@shared/errors.js';
export function importExportRouter(
  service: ImportService,
  imports: ImportRepository,
  bookmarks: BookmarkRepository
) {
  const r = Router();
  r.post('/imports/preview', (req, res) => {
    const html = typeof req.body === 'string' ? req.body : String(req.body?.html ?? '');
    res.status(201).json(service.preview(html, String(req.query.fileName ?? 'bookmarks.html')));
  });
  r.get('/imports/:id', (req, res) => {
    const b = imports.get(req.params.id);
    if (!b) throw new AppError(404, 'NOT_FOUND', 'Import preview not found.');
    res.json({ ...b, entries: imports.entries(req.params.id).slice(0, 100) });
  });
  r.post('/imports/:id/commit', (req, res) => res.json(service.commit(req.params.id)));
  r.delete('/imports/:id', (req, res) => {
    if (!imports.cancel(req.params.id))
      throw new AppError(409, 'BAD_REQUEST', 'Import cannot be cancelled.');
    res.status(204).end();
  });
  r.get('/exports/bookmarks.html', (_req, res) =>
    res
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="larder-bookmarks.html"'
      })
      .send(writeExport(bookmarks))
  );
  return r;
}
