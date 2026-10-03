import { Router, Request, Response } from 'express';
import multer from 'multer';
import { importBookmarksHtml } from '../services/importer';
import { exportBookmarksHtml } from '../services/exporter';

export const importExportRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

importExportRouter.post('/import', upload.single('file'), (req: Request, res: Response) => {
  const file = (req as Request & { file?: { buffer: Buffer } }).file;
  const html = file ? file.buffer.toString('utf-8') : typeof req.body?.html === 'string' ? req.body.html : '';
  if (!html) {
    return res.status(400).json({ error: { code: 'no_file', message: 'No bookmark file provided.' } });
  }
  const result = importBookmarksHtml(html);
  return res.json(result);
});

importExportRouter.get('/export', (_req: Request, res: Response) => {
  const html = exportBookmarksHtml();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  return res.send(html);
});
