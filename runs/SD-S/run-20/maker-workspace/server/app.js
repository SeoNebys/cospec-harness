import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { router as apiRouter } from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '..', 'public');

export function createApp() {
  const app = express();

  app.use(express.json());

  // Restrictive CSP: the frontend uses no inline scripts and no third-party
  // origins, so this locks rendering to same-origin assets (FR-014 defense).
  app.use((_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self'; " +
        "script-src 'self'; base-uri 'self'; form-action 'self'; " +
        "object-src 'none'; frame-ancestors 'none'"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use('/api', apiRouter);

  // Static frontend (served from the same origin/port as the API).
  app.use(express.static(PUBLIC_DIR));

  // JSON 404 for unknown API routes; fall through to SPA index otherwise.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Unknown endpoint.' });
  });

  return app;
}
