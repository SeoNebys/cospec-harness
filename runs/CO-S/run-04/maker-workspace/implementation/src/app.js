'use strict';

const fs = require('fs');
const path = require('path');
const { looksLikeUrl, fallbackName } = require('./links');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// createApp wires the request handler to its dependencies so tests can inject a
// temp store and a fake title fetcher (no real network).
function createApp({ store, fetchTitle }) {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;

      if (pathname.startsWith('/api/')) {
        return await handleApi(req, res, pathname, { store, fetchTitle });
      }
      return serveStatic(res, pathname);
    } catch (e) {
      sendJson(res, 500, { error: 'server_error', message: String(e && e.message || e) });
    }
  };
}

async function handleApi(req, res, pathname, { store, fetchTitle }) {
  // GET /api/bookmarks
  if (pathname === '/api/bookmarks' && req.method === 'GET') {
    return sendJson(res, 200, { bookmarks: store.list() });
  }

  // POST /api/bookmarks  { url }
  if (pathname === '/api/bookmarks' && req.method === 'POST') {
    const body = await readJson(req);
    const rawUrl = (body && body.url ? String(body.url) : '').trim();
    if (!rawUrl) return sendJson(res, 400, { error: 'missing_url' });

    // SCN-008: duplicate -> do not create a copy; point to the existing one.
    const existing = store.findByUrl(rawUrl);
    if (existing) {
      return sendJson(res, 200, { duplicate: true, bookmark: existing });
    }

    // SCN-001/006: try to find the page name; null -> fallback + nudge.
    const found = await fetchTitle(rawUrl);
    const bookmark = found
      ? store.add({ url: rawUrl, title: found, nameStatus: 'found' })
      : store.add({ url: rawUrl, title: fallbackName(rawUrl), nameStatus: 'fallback' });
    return sendJson(res, 201, { bookmark, looksLikeLink: looksLikeUrl(rawUrl) });
  }

  // Routes with an :id segment.
  const m = pathname.match(/^\/api\/bookmarks\/([^/]+)(?:\/(restore))?$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const sub = m[2];

    // POST /api/bookmarks/:id/restore  { bookmark, index }  (SCN-004 undo)
    if (sub === 'restore' && req.method === 'POST') {
      const body = await readJson(req);
      const restored = store.restore(body && body.bookmark, body && body.index);
      if (!restored) return sendJson(res, 400, { error: 'cannot_restore' });
      return sendJson(res, 200, { bookmark: restored });
    }

    // PATCH /api/bookmarks/:id  { title }  (SCN-002 rename)
    if (!sub && req.method === 'PATCH') {
      const body = await readJson(req);
      const title = body && typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return sendJson(res, 400, { error: 'empty_title' }); // SCN-002: empty keeps old name
      const updated = store.rename(id, title);
      if (!updated) return sendJson(res, 404, { error: 'not_found' });
      return sendJson(res, 200, { bookmark: updated });
    }

    // DELETE /api/bookmarks/:id  (SCN-004 remove)
    if (!sub && req.method === 'DELETE') {
      const removed = store.remove(id);
      if (!removed) return sendJson(res, 404, { error: 'not_found' });
      return sendJson(res, 200, { bookmark: removed.record, index: removed.index });
    }
  }

  return sendJson(res, 404, { error: 'not_found' });
}

function serveStatic(res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { // guard against path traversal
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

module.exports = { createApp };
