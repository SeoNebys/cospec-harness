// T008: Express app wiring — JSON API under /api plus the static SPA.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import apiRouter from './routes/api.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const publicDir = join(repoRoot, 'public');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', apiRouter);

  // Static client (built by `npm run build` into public/).
  app.use(express.static(publicDir));

  // SPA fallback: non-API GETs return index.html so hash routing works.
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    const index = join(publicDir, 'index.html');
    if (existsSync(index)) return res.sendFile(index);
    next();
  });

  // JSON error handler (FR: user-friendly errors).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

export default createApp;
