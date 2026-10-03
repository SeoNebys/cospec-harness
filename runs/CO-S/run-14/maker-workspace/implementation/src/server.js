/*
 * Zero-dependency HTTP server: serves the static frontend and the JSON API.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const svc = require('./service');

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, '..', 'public');
const SRC = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'content-type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function sendJson(res, code, obj) { send(res, code, obj); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''; let size = 0;
    req.on('data', c => { size += c.length; if (size > 20 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); } data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) { send(res, 404, { error: 'not found' }); return; }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, buf, { 'content-type': MIME[ext] || 'application/octet-stream' });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const p = decodeURIComponent(url.pathname);
    const method = req.method.toUpperCase();

    // ---- API ----
    if (p.startsWith('/api/')) return await handleApi(req, res, method, p, url);

    // ---- shared browser modules ----
    if (p === '/lib/query.js') return serveStatic(res, path.join(SRC, 'query.js'));
    if (p === '/lib/markdown.js') return serveStatic(res, path.join(SRC, 'markdown.js'));
    if (p === '/lib/importexport.js') return serveStatic(res, path.join(SRC, 'importexport.js'));

    // ---- static frontend ----
    if (p === '/' ) return serveStatic(res, path.join(PUBLIC, 'index.html'));
    const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(PUBLIC, safe);
    if (!filePath.startsWith(PUBLIC)) return send(res, 403, { error: 'forbidden' });
    return serveStatic(res, filePath);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

async function handleApi(req, res, method, p, url) {
  // snapshot file
  let m;
  if (method === 'GET' && (m = p.match(/^\/api\/bookmarks\/([^/]+)\/snapshot$/))) {
    const bm = svc.getBookmark(m[1]);
    if (!bm || !bm.snapshot) return send(res, 404, { error: 'no snapshot' });
    return serveStatic(res, path.join(require('./store').SNAP_DIR, bm.snapshot.file));
  }
  if (method === 'GET' && p === '/api/state') return sendJson(res, 200, svc.getState());

  if (method === 'POST' && p === '/api/bookmarks') {
    const b = await readBody(req);
    const r = await svc.createBookmark({ url: b.url, tags: b.tags, note: b.note });
    if (r.status === 'invalid') return sendJson(res, 400, { error: 'invalid-link' });
    if (r.status === 'duplicate') return sendJson(res, 409, { error: 'duplicate', existingId: r.existingId });
    return sendJson(res, 201, { bookmark: r.bookmark });
  }
  if (method === 'POST' && p === '/api/bookmarks/restore') {
    const b = await readBody(req); svc.restoreBookmarks(b.entries || []); return sendJson(res, 200, svc.getState());
  }
  if (method === 'POST' && p === '/api/bookmarks/bulk') {
    const b = await readBody(req); const r = svc.bulk(b.ids || [], b.action, b.payload); return sendJson(res, 200, r);
  }
  if (method === 'POST' && (m = p.match(/^\/api\/bookmarks\/([^/]+)\/snapshot$/))) {
    const r = await svc.snapshot(m[1]); return sendJson(res, r.ok ? 200 : 502, r);
  }
  if (method === 'POST' && (m = p.match(/^\/api\/bookmarks\/([^/]+)\/archive-org$/))) {
    const r = await svc.archiveOrg(m[1]); return sendJson(res, r.ok ? 200 : 502, r);
  }
  if (method === 'PATCH' && (m = p.match(/^\/api\/bookmarks\/([^/]+)$/))) {
    const b = await readBody(req); const r = await svc.updateBookmark(m[1], b);
    if (r.status === 'not-found') return sendJson(res, 404, { error: 'not-found' });
    return sendJson(res, 200, r);
  }
  if (method === 'DELETE' && (m = p.match(/^\/api\/bookmarks\/([^/]+)$/))) {
    const r = svc.deleteBookmark(m[1]);
    if (r.status === 'not-found') return sendJson(res, 404, { error: 'not-found' });
    return sendJson(res, 200, r);
  }
  if (method === 'POST' && p === '/api/import') {
    const b = await readBody(req); const r = svc.importBookmarks(b.items || [], { addFolderTags: b.addFolderTags, skipDupes: b.skipDupes }); return sendJson(res, 200, r);
  }
  if (method === 'POST' && p === '/api/saved-searches') {
    const b = await readBody(req); return sendJson(res, 201, { savedSearch: svc.addSavedSearch(b) });
  }
  if (method === 'DELETE' && (m = p.match(/^\/api\/saved-searches\/([^/]+)$/))) {
    svc.removeSavedSearch(m[1]); return sendJson(res, 200, { status: 'ok' });
  }
  if (method === 'PUT' && p === '/api/preferences') {
    const b = await readBody(req); return sendJson(res, 200, { preferences: svc.updatePreferences(b) });
  }
  return send(res, 404, { error: 'no such endpoint' });
}

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log('Bookmarks app on http://' + HOST + ':' + PORT));
}
module.exports = { server };
