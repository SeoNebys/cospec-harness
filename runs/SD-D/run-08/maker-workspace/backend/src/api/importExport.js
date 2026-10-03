import express from 'express';
import multer from 'multer';
import { importNetscape, exportNetscape } from '../services/importExport.js';
import { validationError } from './errors.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/import — multipart upload of a Netscape bookmark HTML file (FR-035, FR-036).
router.post('/import', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) throw validationError('No file uploaded.');
    const html = req.file.buffer.toString('utf8');
    res.json(importNetscape(html));
  } catch (err) {
    next(err);
  }
});

// GET /api/export — download the collection as Netscape HTML (FR-037).
router.get('/export', (_req, res) => {
  const html = exportNetscape();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(html);
});

export default router;
