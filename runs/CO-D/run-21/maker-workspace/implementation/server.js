'use strict';
// HTTP server: serves the SPA and a small REST API over the Service layer.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Store } = require('./lib/store');
const { Service } = require('./lib/service');

function createServer(opts = {}) {
  const dataDir = opts.dataDir || path.join(__dirname, 'data');
  const store = new Store(dataDir);
  const service = new Service(store, { capOpts: opts.capOpts || {} });
  const publicDir = path.join(__dirname, 'public');

  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      const p = u.pathname;
      if (p.startsWith('/api/')) return await handleApi(req, res, u, service);
      return serveStatic(res, publicDir, p);
    } catch (e) {
      send(res, 500, { error: String(e && e.message || e) });
    }
  });
  server._service = service; // exposed for tests
  return server;
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
  });
}

async function handleApi(req, res, u, service) {
  const p = u.pathname;
  const method = req.method;

  if (p === '/api/state' && method === 'GET') return send(res, 200, service.state());

  if (p === '/api/preview' && method === 'POST') {
    const b = await readBody(req);
    const meta = await service.previewMeta(String(b.url || ''));
    return send(res, 200, meta);
  }

  if (p === '/api/bookmarks' && method === 'POST') {
    const b = await readBody(req);
    const r = await service.createBookmark(b);
    if (r.duplicate) return send(res, 409, { duplicate: true, existing: r.existing });
    return send(res, 201, r);
  }

  const mId = /^\/api\/bookmarks\/(\d+)(\/[a-z]+)?$/.exec(p);
  if (mId) {
    const id = parseInt(mId[1], 10);
    const sub = mId[2];
    if (!sub && method === 'PATCH') {
      const patch = await readBody(req);
      const r = service.updateBookmark(id, patch);
      if (r.error === 'not_found') return send(res, 404, r);
      if (r.error === 'duplicate') return send(res, 409, r);
      return send(res, 200, r);
    }
    if (!sub && method === 'DELETE') {
      const r = service.deleteBookmark(id);
      return send(res, r.error ? 404 : 200, r);
    }
    if (sub === '/retry' && method === 'POST') {
      const r = await service.retry(id);
      return send(res, r.error ? 404 : 200, r);
    }
    if (sub === '/archiveorg' && method === 'POST') {
      try { const b = await service.sendToArchive(id); return send(res, 200, { ok: true, bookmark: b }); }
      catch (e) { return send(res, 502, { error: e.message }); }
    }
    if (sub === '/copy' && method === 'GET') {
      const b = service.store.getBookmark(id);
      if (!b || !b.preserved || b.preserved.status !== 'saved') { res.writeHead(404); return res.end('No saved copy'); }
      const kind = b.preserved.kind;
      const data = service.store.readSnapshot(id, kind);
      if (!data) { res.writeHead(404); return res.end('No saved copy'); }
      res.writeHead(200, { 'Content-Type': kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8' });
      return res.end(data);
    }
  }

  if (p === '/api/bulk' && method === 'POST') {
    const b = await readBody(req);
    return send(res, 200, service.bulk(b.action, b.ids, b.payload || {}));
  }

  if (p === '/api/import' && method === 'POST') {
    const b = await readBody(req);
    return send(res, 200, service.importNetscape(String(b.html || '')));
  }
  if (p === '/api/export' && method === 'GET') {
    const html = service.exportNetscape();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bookmarks-' + new Date().toISOString().slice(0, 10) + '.html"',
    });
    return res.end(html);
  }

  if (p === '/api/saved-searches' && method === 'POST') {
    const b = await readBody(req);
    return send(res, 201, service.addSavedSearch(b));
  }
  const mSs = /^\/api\/saved-searches\/(\d+)$/.exec(p);
  if (mSs && method === 'DELETE') return send(res, 200, service.deleteSavedSearch(parseInt(mSs[1], 10)));

  if (p === '/api/prefs' && method === 'PUT') {
    const b = await readBody(req);
    return send(res, 200, service.setPrefs(b));
  }

  return send(res, 404, { error: 'not_found' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(res, dir, p) {
  let rel = p === '/' ? '/index.html' : p;
  const file = path.normalize(path.join(dir, rel));
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = process.env.PORT || 4000;
  const server = createServer();
  server.listen(port, '0.0.0.0', () => console.log('Bookmarks app listening on ' + port));
}
