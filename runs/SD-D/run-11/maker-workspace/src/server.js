import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db/index.js'; // ensure schema bootstrap on startup
import apiRouter from './routes/index.js';

process.on('uncaughtException', (e) => {
  console.error('UNCAUGHT EXCEPTION:', e && e.stack ? e.stack : e);
});
process.on('unhandledRejection', (e) => {
  console.error('UNHANDLED REJECTION:', e && e.stack ? e.stack : e);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP session cookie for the single local user. Cookie settings are chosen to
// work in the review environment (not marked Secure so it survives plain HTTP;
// production hardening is kept separate per project conventions).
app.use(
  session({
    name: 'bm.sid',
    secret: 'bookmark-manager-local-review',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 24 * 30 },
  })
);

// Establish a per-visitor session id (single local user model).
app.use((req, _res, next) => {
  if (!req.session.user) req.session.user = 'local';
  next();
});

app.use('/api', apiRouter);

app.use(express.static(PUBLIC_DIR));

// SPA fallback: serve index.html for non-API GETs.
app.get(/^(?!\/api).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Central error handler → shared error shape.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, _next) => {
  console.error('Unhandled error:', error);
  if (res.headersSent) return;
  res
    .status(500)
    .json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark Manager listening on http://0.0.0.0:${PORT}`);
});
server.on('error', (e) => {
  console.error(`Failed to start server on port ${PORT}: ${e.message}`);
  process.exit(1);
});

export default app;
