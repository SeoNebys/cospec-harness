'use strict';
// End-to-end: capture a real page with external CSS/image, take the origin
// OFFLINE, and confirm the saved copy is self-contained (SCN-013).
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { captureCopy } = require('../src/lib/metadata');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

function startOrigin() {
  const server = http.createServer((req, res) => {
    if (req.url === '/page.html') { res.setHeader('content-type', 'text/html'); res.end(`<!doctype html><html><head><link rel="stylesheet" href="/style.css"><script src="/app.js"></script></head><body><img id="logo" src="/logo.png"><div class="box"></div></body></html>`); }
    else if (req.url === '/style.css') { res.setHeader('content-type', 'text/css'); res.end(`body{background:rgb(10,125,51);} .box{background:url('/dot.png');}`); }
    else if (req.url === '/logo.png' || req.url === '/dot.png') { res.setHeader('content-type', 'image/png'); res.end(PNG); }
    else if (req.url === '/app.js') { res.setHeader('content-type', 'application/javascript'); res.end(`document.title='live';`); }
    else { res.statusCode = 404; res.end('no'); }
  });
  return server;
}

test('preserved page copy is self-contained after the origin goes offline', async () => {
  const server = startOrigin();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-copy-'));

  const result = await captureCopy(`http://127.0.0.1:${port}/page.html`, 1, dir);
  await new Promise(r => server.close(r)); // origin is now OFFLINE

  assert.strictEqual(result.status, 'saved');
  assert.strictEqual(result.kind, 'page');
  const html = fs.readFileSync(result.path, 'utf8');

  // No live resource loads remain: no <link>, no <script>, no http(s) src/href to the origin.
  assert.ok(!/<link\b/i.test(html), 'stylesheet <link> was inlined');
  assert.ok(!/<script\b/i.test(html), 'live scripts removed');
  assert.ok(!new RegExp(`(src|href)\\s*=\\s*["']https?://127\\.0\\.0\\.1:${port}`, 'i').test(html), 'no live-origin resource references');
  // Assets are embedded.
  assert.ok(html.includes('data:image/png;base64,'), 'images/backgrounds inlined as data URIs');
  assert.ok(/background:\s*rgb\(10,125,51\)/i.test(html), 'stylesheet content inlined');

  fs.rmSync(dir, { recursive: true, force: true });
});
