import { Router } from 'express';
import multer from 'multer';
import { importNetscape } from '../services/bookmarksImport.js';
import { exportNetscape } from '../services/bookmarksExport.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();

// POST /api/import — import a Netscape bookmark HTML file (FR-030/FR-031)
router.post('/import', upload.single('file'), (req, res) => {
  const html = req.file ? req.file.buffer.toString('utf8') : (req.body && req.body.html);
  if (!html) {
    return res.status(400).json({ error: { code: 'no_file', message: 'A bookmark file is required' } });
  }
  const result = importNetscape(html);
  res.json(result);
});

// GET /api/export — export a Netscape bookmark HTML file (FR-032)
router.get('/export', (_req, res) => {
  const html = exportNetscape();
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.type('text/html').send(html);
});

export default router;
