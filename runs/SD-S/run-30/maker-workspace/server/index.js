import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bookmarksRouter from './routes/bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use('/api', bookmarksRouter);

// Serve the single-page frontend.
app.use(express.static(join(__dirname, '..', 'public')));

// JSON 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Only start listening when run directly (tests import the app/router instead).
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
  });
}

export default app;
