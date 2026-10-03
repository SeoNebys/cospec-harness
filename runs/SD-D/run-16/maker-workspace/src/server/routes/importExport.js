import express from 'express';
import { exportBookmarks, importBookmarks } from '../services/importExport.js';

export const importExportRouter = express.Router();

// Accept the uploaded bookmark file as a raw text body (text/html or plain).
importExportRouter.use(express.text({ type: ['text/html', 'text/plain', 'application/octet-stream'], limit: '10mb' }));

// GET /api/export — download a Netscape bookmark file
importExportRouter.get('/export', (req, res) => {
  const body = exportBookmarks();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
  res.send(body);
});

// POST /api/import — import a bookmark file (raw body)
importExportRouter.post('/import', (req, res) => {
  const result = importBookmarks(req.body || '');
  res.json(result);
});
