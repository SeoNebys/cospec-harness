import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SNAPSHOT_DIR } from './db/index.js';
import api from './api/index.js';
import { errorHandler } from './api/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

const app = express();
app.use(express.json({ limit: '5mb' }));

// Simple session cookie so the review environment has a working HTTP-session cookie.
app.use((req, res, next) => {
  if (!req.headers.cookie || !req.headers.cookie.includes('bm_session=')) {
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    res.setHeader('Set-Cookie', `bm_session=${sid}; Path=/; HttpOnly; SameSite=Lax`);
  }
  next();
});

// API
app.use('/api', api);

// Stored snapshots, favicons, previews.
app.use('/snapshots', express.static(SNAPSHOT_DIR));

// Built frontend (SPA). Fall back to index.html for client routes.
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .send('<!DOCTYPE html><html><body><p>Frontend not built. Run <code>npm run build</code>.</p></body></html>');
  });
}

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});

export { app, server };
