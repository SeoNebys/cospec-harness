import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { createStore } from './store.js';
import { createService } from './service.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const implementationDirectory = path.resolve(sourceDirectory, '..');
const publicDirectory = path.join(implementationDirectory, 'public');

function numericId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error('Bookmark not found.');
    error.code = 'not_found'; error.status = 404; throw error;
  }
  return id;
}

function requireBookmark(value) {
  if (!value) {
    const error = new Error('Bookmark not found.');
    error.code = 'not_found'; error.status = 404; throw error;
  }
  return value;
}

export function createApplication({ databasePath, allowPrivateFetch = false, testMode = false } = {}) {
  const resolvedDatabase = path.resolve(databasePath ?? path.join(implementationDirectory, 'data', 'keepwell.sqlite'));
  fs.mkdirSync(path.dirname(resolvedDatabase), { recursive: true });
  const store = createStore(resolvedDatabase);
  const service = createService(store, { allowPrivateFetch });
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((request, response, next) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/api/health', (_request, response) => response.json({ ok: true }));

  app.get('/api/state', (request, response) => {
    const list = store.listBookmarks({
      section: request.query.section,
      query: request.query.q,
      tag: request.query.tag,
      sort: request.query.sort,
      page: request.query.page,
      perPage: 8,
    });
    response.json({ ...list, navigation: store.getNavigation() });
  });

  app.get('/api/bookmarks/:id', (request, response) => {
    response.json(requireBookmark(store.getBookmark(numericId(request.params.id))));
  });

  app.post('/api/bookmarks', async (request, response, next) => {
    try {
      const bookmark = await service.saveUrl(request.body?.url);
      response.status(201).json(bookmark);
    } catch (error) { next(error); }
  });

  app.post('/api/bookmarks/manual', (request, response, next) => {
    try {
      response.status(201).json(service.saveManual(request.body ?? {}));
    } catch (error) { next(error); }
  });

  app.patch('/api/bookmarks/:id', (request, response, next) => {
    try {
      response.json(requireBookmark(store.updateDetails(numericId(request.params.id), request.body ?? {})));
    } catch (error) { next(error); }
  });

  app.put('/api/bookmarks/:id/tags', (request, response, next) => {
    try {
      response.json(requireBookmark(store.setTags(numericId(request.params.id), request.body?.tags)));
    } catch (error) { next(error); }
  });

  app.get('/api/tags/suggest', (request, response) => {
    const exclude = String(request.query.exclude ?? '').split(',').filter(Boolean);
    response.json(store.suggestTags(String(request.query.q ?? ''), exclude));
  });

  app.patch('/api/bookmarks/:id/read-later', (request, response, next) => {
    try {
      response.json(requireBookmark(store.setReadLater(numericId(request.params.id), Boolean(request.body?.value))));
    } catch (error) { next(error); }
  });

  app.post('/api/bookmarks/:id/archive', (request, response, next) => {
    try { response.json(requireBookmark(store.archive(numericId(request.params.id)))); }
    catch (error) { next(error); }
  });

  app.post('/api/bookmarks/:id/restore', (request, response, next) => {
    try { response.json(requireBookmark(store.restore(numericId(request.params.id)))); }
    catch (error) { next(error); }
  });

  app.delete('/api/bookmarks/:id', (request, response, next) => {
    try { response.json(requireBookmark(store.deleteBookmark(numericId(request.params.id)))); }
    catch (error) { next(error); }
  });

  app.get('/api/bookmarks/:id/availability', async (request, response, next) => {
    try { response.json(requireBookmark(await service.availability(numericId(request.params.id)))); }
    catch (error) { next(error); }
  });

  app.post('/api/views', (request, response, next) => {
    try { response.status(201).json(store.createSavedView(request.body ?? {})); }
    catch (error) { next(error); }
  });

  if (testMode) {
    app.post('/api/__test/reset', (_request, response) => {
      store.clearAll();
      response.json({ ok: true });
    });
    app.post('/api/__test/seed', (request, response, next) => {
      try {
        const rows = Array.isArray(request.body?.bookmarks) ? request.body.bookmarks : [];
        const inserted = rows.map((bookmark) => store.insertBookmark({
          url: bookmark.url,
          canonical_url: bookmark.canonical_url,
          title: bookmark.title,
          description: bookmark.description ?? '',
          source_host: bookmark.source_host ?? '',
          site_name: bookmark.site_name ?? '',
          author: bookmark.author ?? '',
          published_at: bookmark.published_at ?? null,
          preview_image: bookmark.preview_image ?? '',
          content_html: bookmark.content_html ?? '',
          capture_status: bookmark.capture_status ?? 'captured',
          captured_at: bookmark.captured_at ?? new Date().toISOString(),
          created_at: bookmark.created_at,
        }));
        for (let index = 0; index < inserted.length; index += 1) {
          if (rows[index].tags) store.setTags(inserted[index].id, rows[index].tags);
          if (rows[index].read_later) store.setReadLater(inserted[index].id, true);
          if (rows[index].archived) store.archive(inserted[index].id);
        }
        response.status(201).json({ bookmarks: inserted.map((row) => store.getBookmark(row.id)) });
      } catch (error) { next(error); }
    });
  }

  app.use(express.static(publicDirectory, { extensions: ['html'], maxAge: 0 }));
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) return next();
    response.sendFile(path.join(publicDirectory, 'index.html'));
  });

  app.use((error, _request, response, _next) => {
    const status = Number(error.status) || 500;
    const payload = {
      error: {
        code: error.code ?? 'internal_error',
        message: status >= 500 ? 'Something went wrong.' : error.message,
      },
    };
    if (error.bookmark) payload.error.bookmark = error.bookmark;
    if (error.url) payload.error.url = error.url;
    if (status >= 500) console.error(error);
    response.status(status).json(payload);
  });

  return { app, store };
}

export function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 4000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const databasePath = options.databasePath ?? process.env.KEEPWELL_DB;
  const testMode = options.testMode ?? process.env.KEEPWELL_TEST_MODE === '1';
  const allowPrivateFetch = options.allowPrivateFetch ?? process.env.KEEPWELL_ALLOW_PRIVATE_FETCH === '1';
  const { app, store } = createApplication({ databasePath, testMode, allowPrivateFetch });
  const server = app.listen(port, host, () => console.log(`Keepwell listening on http://${host}:${port}`));
  const close = () => server.close(() => store.close());
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
  return { server, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer();
}
