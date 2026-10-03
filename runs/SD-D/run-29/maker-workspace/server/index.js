import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import './db.js'; // initialize schema on boot
import { ValidationError } from './services/url.js';
import { router as bookmarksRouter } from './routes/bookmarks.js';
import { router as tagsRouter } from './routes/tags.js';
import { router as filtersRouter } from './routes/filters.js';
import { router as preferencesRouter } from './routes/preferences.js';
import { router as preservationRouter } from './routes/preservation.js';
import { router as portingRouter } from './routes/porting.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));

// API routes
app.use('/api/bookmarks', preservationRouter); // /:id/preserve
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/filters', filtersRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api', portingRouter); // /import, /export

// Static frontend
app.use(express.static(join(__dirname, '..', 'public')));

// Centralized error handler. Validation problems -> 400; unexpected -> 500.
// External capture/IA failures are handled inside services as status fields.
app.use((err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  // Async wrappers surface thrown promise rejections here for known types too.
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bookmark Manager listening on http://0.0.0.0:${PORT}`);
});
server.on('error', (err) => {
  console.error(`Failed to start server on port ${PORT}: ${err.message}`);
  process.exit(1);
});
