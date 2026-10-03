import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { BookmarkStore } from './lib/database.js';
import { InvalidUrlError, normalizeUrl, parseWebUrl, siteNameFromUrl } from './lib/url.js';
import { metadataWithFallback } from './lib/metadata.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function integerId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function idList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(integerId).filter(Boolean))];
}

function requiredText(value, message) {
  const text = String(value || '').trim();
  if (!text) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  return text;
}

export function createApp(options = {}) {
  const dbFile = options.dbFile || path.join(moduleDir, 'data', 'bookmarks.sqlite');
  const store = options.store || new BookmarkStore(dbFile);
  const metadataProvider = options.metadataProvider || metadataWithFallback;
  const app = express();

  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: http: https:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    next();
  });
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (request, response) => response.json({ ok: true }));

  app.get('/api/bookmarks', (request, response) => {
    const view = ['active', 'later', 'archived'].includes(request.query.view) ? request.query.view : 'active';
    const items = store.list({ view, search: request.query.search, label: request.query.label });
    response.json({ items, count: items.length, totalActive: store.totalActive(), totalAll: store.totalAll() });
  });

  app.get('/api/labels', (request, response) => {
    response.json({ labels: store.allLabels() });
  });

  app.post('/api/bookmarks/prepare', async (request, response, next) => {
    try {
      const url = requiredText(request.body?.url, 'Enter a full web address beginning with http:// or https://.');
      parseWebUrl(url);
      const existing = store.findByUrl(url);
      if (existing) {
        response.json({ status: 'existing', bookmark: existing });
        return;
      }
      const metadata = await metadataProvider(url);
      response.json({
        status: 'new',
        normalizedUrl: normalizeUrl(url),
        draft: {
          url,
          title: metadata.title,
          description: metadata.description,
          siteName: metadata.siteName || siteNameFromUrl(url),
          faviconUrl: metadata.faviconUrl || null,
          fallback: Boolean(metadata.fallback)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/bookmarks', (request, response, next) => {
    try {
      const input = {
        url: requiredText(request.body?.url, 'A full web address is required.'),
        siteName: requiredText(request.body?.siteName, 'A site name is required.'),
        title: requiredText(request.body?.title, 'A title is required.'),
        description: String(request.body?.description || ''),
        faviconUrl: request.body?.faviconUrl || null,
        labels: Array.isArray(request.body?.labels) ? request.body.labels : [],
        readLater: Boolean(request.body?.readLater)
      };
      const existing = store.findByUrl(input.url);
      if (existing) {
        response.status(409).json({ error: 'This page is already saved.', bookmark: existing });
        return;
      }
      response.status(201).json({ bookmark: store.create(input) });
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        response.status(409).json({ error: 'This page is already saved.', bookmark: store.findByUrl(request.body?.url) });
        return;
      }
      next(error);
    }
  });

  app.patch('/api/bookmarks/:id', (request, response, next) => {
    try {
      const id = integerId(request.params.id);
      if (!id) return response.status(400).json({ error: 'Invalid bookmark.' });
      const changes = {};
      for (const key of ['title', 'description', 'labels', 'readLater', 'archived']) {
        if (Object.hasOwn(request.body || {}, key)) changes[key] = request.body[key];
      }
      const bookmark = store.update(id, changes);
      if (!bookmark) return response.status(404).json({ error: 'Bookmark not found.' });
      response.json({ bookmark });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/bookmarks/:id', (request, response) => {
    const id = integerId(request.params.id);
    if (!id) return response.status(400).json({ error: 'Invalid bookmark.' });
    if (!store.delete(id)) return response.status(404).json({ error: 'Bookmark not found.' });
    response.status(204).end();
  });

  app.post('/api/bookmarks/bulk', (request, response, next) => {
    try {
      const ids = idList(request.body?.ids);
      if (!ids.length) return response.status(400).json({ error: 'Select at least one bookmark.' });
      switch (request.body?.action) {
        case 'addLabel': {
          const label = requiredText(request.body?.label, 'Choose or create a label.');
          response.json({ bookmarks: store.bulkAddLabel(ids, label), label: store.labelForName(label).name });
          return;
        }
        case 'readLater':
          response.json({ bookmarks: store.bulkReadLater(ids) });
          return;
        case 'delete':
          response.json({ deleted: store.bulkDelete(ids) });
          return;
        default:
          response.status(400).json({ error: 'Unknown bulk action.' });
      }
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(path.join(moduleDir, 'public'), { extensions: ['html'] }));
  app.get('/{*path}', (request, response) => response.sendFile(path.join(moduleDir, 'public', 'index.html')));

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    const status = error instanceof InvalidUrlError ? 400 : error.status || 500;
    const message = status >= 500 ? 'Something went wrong. Please try again.' : error.message;
    if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(error);
    response.status(status).json({ error: message });
  });

  return { app, store };
}
