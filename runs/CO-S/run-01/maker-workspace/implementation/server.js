import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './src/store.js';
import { fetchMetadata } from './src/metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const DATA_FILE = process.env.BOOKMARKS_DATA_FILE || path.join(__dirname, 'data', 'bookmarks.json');
const ALLOW_TEST_RESET = process.env.ALLOW_TEST_RESET === '1';

function isValidHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'http:' || x.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function createApp(store) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/bookmarks', (req, res) => res.json(store.all()));

  app.post('/api/bookmarks', async (req, res) => {
    const { url } = req.body || {};
    if (!isValidHttpUrl(url)) return res.status(400).json({ error: 'invalid url' });
    const b = await store.create(req.body);
    res.status(201).json(b);
  });

  app.put('/api/bookmarks/:id', async (req, res) => {
    const b = await store.update(req.params.id, req.body || {});
    if (!b) return res.status(404).json({ error: 'not found' });
    res.json(b);
  });

  app.delete('/api/bookmarks/:id', async (req, res) => {
    const ok = await store.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  });

  // Fetch a link's details. Returns {ok:true, meta} or {ok:false, reason}.
  app.get('/api/fetch-details', async (req, res) => {
    const url = req.query.url;
    if (!isValidHttpUrl(url)) return res.status(400).json({ ok: false, reason: 'invalid' });
    try {
      const meta = await fetchMetadata(url);
      res.json({ ok: true, meta });
    } catch {
      res.json({ ok: false, reason: 'unreachable' });
    }
  });

  if (ALLOW_TEST_RESET) {
    app.post('/api/_test/reset', async (req, res) => {
      await store.reset();
      res.status(204).end();
    });
  }

  return app;
}

// Only start listening when run directly (not when imported by tests).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const store = await new Store(DATA_FILE).init();
  const app = await createApp(store);
  app.listen(PORT, '0.0.0.0', () => console.log(`Bookmarks app listening on ${PORT}`));
}
