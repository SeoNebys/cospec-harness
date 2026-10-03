// HTTP server: REST API + static frontend for the bookmark library.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Store } = require('./store.js');
const { fetchMetadata } = require('./metadata.js');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'bookmarks.json');

const store = new Store(DATA_FILE);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

async function handleApi(req, res, pathname) {
  const method = req.method;

  if (method === 'GET' && pathname === '/api/bookmarks') {
    return sendJson(res, 200, { bookmarks: store.all() });
  }

  if (method === 'POST' && pathname === '/api/preview') {
    const body = await readBody(req);
    const found = store.findExisting(body.url);
    if (found.error) return sendJson(res, 400, { error: found.error });
    if (found.existing) return sendJson(res, 200, { duplicate: true, bookmark: found.existing });
    const meta = await fetchMetadata(found.url);
    return sendJson(res, 200, {
      duplicate: false,
      preview: {
        url: found.url, title: meta.title, description: meta.description,
        siteName: meta.siteName, favicon: meta.favicon, image: meta.image, retrieved: meta.retrieved,
      },
    });
  }

  if (method === 'POST' && pathname === '/api/bookmarks') {
    const body = await readBody(req);
    const r = store.create(body);
    if (r.error === 'invalid_url') return sendJson(res, 400, { error: 'invalid_url' });
    return sendJson(res, 200, r);
  }

  const m = pathname.match(/^\/api\/bookmarks\/(\d+)(\/state|\/tags\/add|\/tags\/remove)?$/);
  if (m) {
    const id = Number(m[1]);
    const sub = m[2] || '';
    if (method === 'PATCH' && sub === '') {
      const body = await readBody(req);
      const r = store.update(id, body);
      if (r.error === 'not_found') return sendJson(res, 404, { error: 'not_found' });
      if (r.error === 'invalid_url') return sendJson(res, 400, { error: 'invalid_url' });
      if (r.error === 'duplicate_address') return sendJson(res, 409, { error: 'duplicate_address', title: r.title });
      return sendJson(res, 200, r);
    }
    if (method === 'DELETE' && sub === '') {
      const r = store.remove(id);
      if (r.error) return sendJson(res, 404, { error: r.error });
      return sendJson(res, 200, r);
    }
    if (method === 'POST' && sub === '/state') {
      const body = await readBody(req);
      const r = store.setState(id, body);
      if (r.error) return sendJson(res, 404, { error: r.error });
      return sendJson(res, 200, r);
    }
    if (method === 'POST' && sub === '/tags/add') {
      const body = await readBody(req);
      const r = store.addTag(id, body.tag);
      if (r.error === 'not_found') return sendJson(res, 404, { error: r.error });
      if (r.error === 'empty_tag') return sendJson(res, 400, { error: r.error });
      return sendJson(res, 200, r);
    }
    if (method === 'POST' && sub === '/tags/remove') {
      const body = await readBody(req);
      const r = store.removeTag(id, body.tag);
      if (r.error) return sendJson(res, 404, { error: r.error });
      return sendJson(res, 200, r);
    }
  }

  if (method === 'POST' && pathname === '/api/bulk') {
    const body = await readBody(req);
    const r = store.bulk(body.ids, body.action, body.value);
    if (r.error) return sendJson(res, 400, { error: r.error });
    return sendJson(res, 200, r);
  }

  return sendJson(res, 404, { error: 'not_found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = req.url.split('?')[0];
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    return serveStatic(req, res, pathname);
  } catch (e) {
    sendJson(res, 500, { error: 'server_error', detail: String(e && e.message) });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('Bookmark library on http://' + HOST + ':' + PORT + ' (data: ' + DATA_FILE + ')');
  });
}

module.exports = { server: server, store: store };
