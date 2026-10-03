import { Router } from 'express';
import multer from 'multer';
import { importNetscapeHtml } from '../services/importer.js';
import { exportNetscapeHtml } from '../services/exporter.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/import', upload.single('file'), (req, res) => {
  const html = req.file ? req.file.buffer.toString('utf8') : req.body?.html;
  if (!html) return res.status(400).json({ error: { code: 'no-file', message: 'No bookmark file provided' } });
  res.json(importNetscapeHtml(html));
});

router.get('/export', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(exportNetscapeHtml());
});

export default router;
