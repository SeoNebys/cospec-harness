/*
 * server.js — minimal zero-dependency server.
 *  - serves the static app from src/
 *  - GET /api/title?url=...  -> { ok:true, title } or { ok:false }
 *
 * The title endpoint exists because the browser cannot fetch arbitrary
 * cross-origin pages to read their <title> (SCN-002). Failure is reported
 * as { ok:false } so the UI can degrade gracefully (SCN-007).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { extractTitle } = require('./src/title.js');

const ROOT = path.join(__dirname, 'src');
const PORT = process.env.PORT || 3000;
const TITLE_TIMEOUT_MS = 6000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

async function fetchTitle(target) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, TITLE_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'MyBookmarks/1.0 (+title-lookup)' }
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractTitle(html);
  } catch (e) {
    return null; // network error, timeout, bad host, etc.
  } finally {
    clearTimeout(timer);
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  // prevent path traversal
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safe);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async function (req, res) {
  if (req.url.startsWith('/api/title')) {
    const q = new URL(req.url, 'http://localhost').searchParams.get('url');
    if (!q) return sendJson(res, 400, { ok: false, error: 'missing url' });
    let target;
    try { target = /^https?:\/\//i.test(q) ? q : 'https://' + q; new URL(target); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'bad url' }); }
    const title = await fetchTitle(target);
    return sendJson(res, 200, title ? { ok: true, title: title } : { ok: false });
  }
  serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, function () {
    console.log('My Bookmarks running at http://localhost:' + PORT);
  });
}

module.exports = { server: server, fetchTitle: fetchTitle };
