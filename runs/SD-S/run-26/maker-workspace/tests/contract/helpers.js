// Shared harness for contract tests: a fixture content server + the app on a
// temporary database, so capture/snapshot run for real but hermetically.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A minimal PDF (valid enough for content-type + bytes preservation).
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n'
);

export function startFixtureServer() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/page')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!DOCTYPE html><html><head>
        <title>Fixture Page</title>
        <meta name="description" content="A fixture description." />
        <meta property="og:title" content="Fixture OG Title" />
        <meta property="og:description" content="OG fixture description." />
        <link rel="icon" href="/favicon.ico" />
        </head><body><h1>Hello fixture</h1></body></html>`);
    } else if (req.url.startsWith('/doc.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.end(MINIMAL_PDF);
    } else if (req.url.startsWith('/favicon.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
      res.end(Buffer.from([0, 0, 1, 0]));
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

// Start the app with an isolated temp DB + data dir. Returns { base, close }.
export async function startApp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-'));
  process.env.BOOKMARKS_DB = path.join(tmp, 'test.db');
  // Fresh module graph so db.js picks up the temp DB path.
  const { createApp } = await import(`../../server.js?t=${Date.now()}`);
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((r) => server.close(r)).then(() => fs.rmSync(tmp, { recursive: true, force: true })),
      });
    });
  });
}

export async function jsonFetch(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}
