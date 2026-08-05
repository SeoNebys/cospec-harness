// HTTP layer for the bookmarks app — zero external dependencies (Node's http).
// createApp() takes a Store and a title fetcher (both injectable for tests) and
// returns a request handler that serves the static UI plus the JSON API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const BM = require('./shared');
const { fetchTitle } = require('./titleService');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) reject(new Error('body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { // path traversal guard
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

function createApp(store, options = {}) {
  const titleFetcher = options.titleFetcher || fetchTitle;

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ['api','bookmarks','ID']

    try {
      // Serve the shared logic module straight from src/ so the browser and the
      // server use the exact same file (no duplicated copy in public/).
      if (url.pathname === '/shared.js') {
        return fs.readFile(path.join(__dirname, 'shared.js'), (err, buf) => {
          if (err) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
          res.end(buf);
        });
      }
      if (parts[0] !== 'api') return serveStatic(req, res);

      // /api/bookmarks
      if (parts[1] === 'bookmarks' && parts.length === 2) {
        if (req.method === 'GET') {
          return sendJson(res, 200, store.list());
        }
        if (req.method === 'POST') {
          const body = await readBody(req);
          const raw = (body.url || '').trim();

          // SCN-006: not a link -> block, save nothing.
          if (!BM.looksLikeUrl(raw)) {
            return sendJson(res, 400, { error: 'not_a_link' });
          }
          const normalized = BM.normalizeUrl(raw);

          // SCN-006: duplicate -> do not create a second copy.
          const existing = store.findByUrl(normalized);
          if (existing) {
            return sendJson(res, 409, { error: 'duplicate', existing });
          }

          // SCN-001/006/007: try to fetch the real title, but never block.
          const result = await titleFetcher(normalized);
          const created = store.create({
            url: normalized,
            title: result.ok ? result.title : null,
            needsTitle: !result.ok,
            tags: Array.isArray(body.tags) ? body.tags : []
          });
          return sendJson(res, 201, created);
        }
        res.writeHead(405); return res.end();
      }

      // /api/bookmarks/:id  and  /api/bookmarks/:id/refresh-title
      if (parts[1] === 'bookmarks' && parts.length >= 3) {
        const id = parts[2];

        if (parts.length === 4 && parts[3] === 'refresh-title' && req.method === 'POST') {
          // SCN-007: re-attempt the title fetch later (e.g. once back online).
          const b = store.get(id);
          if (!b) return sendJson(res, 404, { error: 'not_found' });
          const result = await titleFetcher(b.url);
          if (result.ok) {
            return sendJson(res, 200, store.update(id, { title: result.title }));
          }
          return sendJson(res, 200, b); // still no title; leave as-is.
        }

        if (parts.length === 3 && req.method === 'PATCH') {
          const body = await readBody(req);
          const updated = store.update(id, body); // title (add-a-name) and/or tags
          if (!updated) return sendJson(res, 404, { error: 'not_found' });
          return sendJson(res, 200, updated);
        }

        if (parts.length === 3 && req.method === 'DELETE') {
          const ok = store.remove(id);
          if (!ok) return sendJson(res, 404, { error: 'not_found' });
          res.writeHead(204); return res.end();
        }
      }

      return sendJson(res, 404, { error: 'not_found' });
    } catch (e) {
      return sendJson(res, 400, { error: 'bad_request', detail: String(e.message || e) });
    }
  };
}

module.exports = { createApp };
