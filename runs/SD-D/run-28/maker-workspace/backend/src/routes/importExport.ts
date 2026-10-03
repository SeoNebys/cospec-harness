import type { FastifyInstance } from 'fastify';
import type { DB } from '../db/db.ts';
import type { CaptureQueue } from '../services/captureQueue.ts';
import { badRequest } from '../lib/errors.ts';
import { exportBookmarks, importBookmarks } from '../services/importExport.ts';

export function registerImportExportRoutes(
  app: FastifyInstance,
  db: DB,
  queue: CaptureQueue,
): void {
  // Import (multipart file upload) or raw HTML body for tests/tools.
  app.post('/api/import', async (req) => {
    let html = '';
    if (req.isMultipart && req.isMultipart()) {
      const file = await (req as never as { file: () => Promise<{ toBuffer: () => Promise<Buffer> }> }).file();
      if (!file) throw badRequest('No file uploaded.');
      html = (await file.toBuffer()).toString('utf8');
    } else if (typeof req.body === 'string') {
      html = req.body;
    } else if (req.body && typeof (req.body as { html?: string }).html === 'string') {
      html = (req.body as { html: string }).html;
    }
    if (!html.trim()) throw badRequest('Empty import file.');
    const result = importBookmarks(db, html, (job) => queue.enqueue(job));
    return { imported: result.imported, merged: result.merged, skipped: result.skipped };
  });

  // Export as a Netscape bookmark HTML file.
  app.get('/api/export', async (_req, reply) => {
    const html = exportBookmarks(db);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="bookmarks.html"');
    return reply.send(html);
  });
}
