// HTTP server: JSON API for the bookmark collection + the static web client.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BookmarkStore, ValidationError } from './store.js';
import { fetchMetadata } from './metadata.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const DEFAULT_DATA = process.env.BOOKMARKS_DATA || join(__dirname, '..', 'data', 'bookmarks.json');

export function createApp({ dataFile = DEFAULT_DATA, metadataFetcher = fetchMetadata } = {}) {
  const store = new BookmarkStore(dataFile);
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // --- API -----------------------------------------------------------------
  app.get('/api/bookmarks', (_req, res) => {
    res.json({ items: store.list() });
  });

  // Look up a page's title/description/icon for the save form (SCN-001 / SCN-006).
  app.post('/api/metadata', async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ ok: false });
    const meta = await metadataFetcher(url);
    res.json(meta);
  });

  app.post('/api/bookmarks', (req, res) => {
    try {
      const result = store.create(req.body || {});
      if (result.duplicate) return res.status(409).json({ duplicate: true, item: result.item });
      res.status(201).json({ item: result.item });
    } catch (err) {
      if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
      throw err;
    }
  });

  app.put('/api/bookmarks/:id', (req, res) => {
    try {
      const result = store.update(Number(req.params.id), req.body || {});
      if (result === null) return res.status(404).json({ error: 'Not found' });
      if (result.conflict) return res.status(409).json({ conflict: true, item: result.item });
      res.json({ item: result.item });
    } catch (err) {
      if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
      throw err;
    }
  });

  app.delete('/api/bookmarks/:id', (req, res) => {
    const ok = store.remove(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  app.post('/api/bookmarks/:id/archived', (req, res) => {
    const item = store.setArchived(Number(req.params.id), !!(req.body || {}).archived);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
  });

  app.post('/api/bookmarks/:id/unread', (req, res) => {
    const item = store.setUnread(Number(req.params.id), !!(req.body || {}).unread);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
  });

  // Test-only reset, enabled solely when BOOKMARKS_TEST=1 (used by acceptance
  // tests to isolate each scenario). Never active in normal operation.
  if (process.env.BOOKMARKS_TEST === '1') {
    app.post('/api/_test/reset', (_req, res) => {
      store.clear();
      res.json({ ok: true });
    });
  }

  // --- Static client -------------------------------------------------------
  app.use(express.static(PUBLIC_DIR));

  return { app, store };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  const { app } = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`My Bookmarks listening on http://0.0.0.0:${port}`);
  });
}
