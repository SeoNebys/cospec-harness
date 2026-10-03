import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { makeApp } from '../helpers.ts';

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function startOrigin(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><html><head>
        <title>Origin Page</title>
        <link rel="stylesheet" href="/style.css">
        <script src="/app.js"></script>
      </head><body>
        <h1>Hello</h1>
        <img src="/pic.png" srcset="/pic2x.png 2x">
      </body></html>`);
    } else if (req.url === '/style.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(`h1{color:rgb(1,2,3)} body{background:url('/bg.png')}`);
    } else if (req.url === '/pic.png' || req.url === '/bg.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(PNG);
    } else if (req.url === '/app.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end('window.__ran = true;');
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

let createdId = '';
afterEach(() => {
  if (createdId) {
    rmSync(join(process.cwd(), 'data', 'snapshots', createdId), { recursive: true, force: true });
    createdId = '';
  }
});

describe('self-contained HTML preservation (US11 / FR-022)', () => {
  it('stores styles and images locally and renders with the origin offline', async () => {
    const origin = await startOrigin();
    const { app, queue } = makeApp();

    const created = (
      await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: `${origin.url}/page` } })
    ).json();
    createdId = created.id;

    // Wait for background capture (fetch + inline) to finish.
    await queue.onIdle();

    // Take the ORIGINAL SITE OFFLINE — the snapshot must not need it.
    await origin.close();

    const snap = await app.inject({ method: 'GET', url: `/api/bookmarks/${created.id}/snapshot` });
    expect(snap.statusCode).toBe(200);
    const html = snap.body;

    // Stylesheet content is inlined (not linked).
    expect(html).toContain('<style>');
    expect(html).toContain('rgb(1,2,3)');
    expect(html).not.toContain('href="' + origin.url + '/style.css"');

    // Images (and CSS background) are embedded as data URIs — no live refs.
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain(origin.url + '/pic.png');
    expect(html).not.toContain(origin.url + '/bg.png');
    expect(html).not.toContain('srcset');

    // Scripts are stripped so nothing reaches the network at view time.
    expect(html).not.toContain('app.js');
    expect(html.toLowerCase()).not.toContain('<script');

    // Sanity: the captured metadata still worked.
    const fresh = (await app.inject({ method: 'GET', url: `/api/bookmarks/${created.id}` })).json();
    expect(fresh.captureStatus.snapshot).toBe('ready');
    expect(fresh.title).toBe('Origin Page');
  });
});
