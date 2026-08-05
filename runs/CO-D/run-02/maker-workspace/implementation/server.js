#!/usr/bin/env node
/*
 * A tiny static server so the app runs from a stable local address
 * (http://localhost:<port>) instead of a double-clicked file. That stable
 * "home" is what lets the browser reliably keep your saved bookmarks between
 * visits. No dependencies — just Node.
 *
 * Run it via the launcher for your system (start.command / start.sh / start.bat)
 * or:  node server.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const server = http.createServer(function (req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // Resolve safely inside ROOT (no path traversal).
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, function () {
  const url = 'http://localhost:' + PORT + '/';
  console.log('\n  My Bookmarks is running at:  ' + url + '\n  Leave this window open while you use it. Press Ctrl+C to stop.\n');
  // Best-effort: open the default browser.
  const platform = process.platform;
  const opener = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = require('child_process').spawn(opener, [url], { shell: platform === 'win32', stdio: 'ignore', detached: true });
    child.on('error', function () { /* no browser opener here — the user clicks the printed URL */ });
    child.unref();
  } catch (e) { /* just leave the printed URL for the user to click */ }
});
