// HTTP server: serves the web app and a small JSON API over the Store.
// Titles are fetched server-side; data persists to a JSON file (SCN-010).
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Store, normalizeUrl, looksLikeUrl } from './store.js';
import { fetchTitle } from './title.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build the Express app. Dependencies are injectable for testing:
 *  - store: a Store instance
 *  - titleFetcher: async (url) => string
 */
export function createApp({ store, titleFetcher = fetchTitle } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  // All bookmarks, newest first. The client does browsing/search/filtering
  // locally over this list (SCN-003, SCN-004, SCN-005, SCN-006).
  app.get('/api/bookmarks', (req, res) => {
    res.json(store.all());
  });

  // Save a link (SCN-001): validate (SCN-008), block duplicates (SCN-008),
  // fetch the real title (SCN-001 / SCN-009), then persist.
  app.post('/api/bookmarks', async (req, res) => {
    const url = normalizeUrl(req.body && req.body.url);
    if (!url) {
      return res.status(400).json({ error: 'empty', message: 'Please provide a web address.' });
    }
    if (!looksLikeUrl(url)) {
      return res.status(400).json({ error: 'invalid', message: 'That does not look like a web address.' });
    }
    const dup = store.findDuplicate(url);
    if (dup) {
      return res.status(409).json({ error: 'duplicate', bookmark: dup });
    }
    const title = await titleFetcher(url);
    const bookmark = store.add({ url, title, tags: req.body && req.body.tags });
    res.status(201).json(bookmark);
  });

  // Edit title/tags (SCN-002), toggle read-later (SCN-005), archive/restore (SCN-006).
  app.patch('/api/bookmarks/:id', (req, res) => {
    const updated = store.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  });

  // Permanent delete (SCN-007).
  app.delete('/api/bookmarks/:id', (req, res) => {
    const ok = store.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  });

  return app;
}

// Direct start (npm start). Not run when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dataFile = process.env.DATA_FILE || join(__dirname, 'data', 'bookmarks.json');
  const store = new Store(dataFile);
  const app = createApp({ store });
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Bookmarks app listening on http://0.0.0.0:${port} (data: ${dataFile})`);
  });
}
