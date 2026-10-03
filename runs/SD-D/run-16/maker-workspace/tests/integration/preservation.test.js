import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { useTempData } from '../helpers/seed.js';

let svc;
let preservation;
let temp;
let server;
let baseUrl;

before(async () => {
  temp = useTempData();
  svc = await import('../../src/server/services/bookmarks.js');
  preservation = await import('../../src/server/services/preservation.js');

  server = http.createServer((req, res) => {
    if (req.url === '/doc.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.end(Buffer.from('%PDF-1.4 fake pdf body'));
    } else if (req.url === '/page.html') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!DOCTYPE html><html><head><title>Preserve Me</title></head><body><h1>Hello</h1></body></html>');
    } else {
      res.statusCode = 404;
      res.end('no');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  temp.cleanup();
});

test('preserving a PDF address stores the original PDF', async () => {
  const b = svc.createBookmark({ address: `${baseUrl}/doc.pdf`, title: 'PDF' });
  const updated = await preservation.preserveOfflineCopy(b.id);
  assert.equal(updated.preservedCopyKind, 'pdf');
  assert.match(updated.preservedCopyPath, /\.pdf$/);
});

test('preserving a web page stores a single self-contained HTML file', async () => {
  const b = svc.createBookmark({ address: `${baseUrl}/page.html`, title: 'HTML' });
  const updated = await preservation.preserveOfflineCopy(b.id);
  assert.equal(updated.preservedCopyKind, 'html');
  const file = preservation.readPreservedFile(b.id);
  assert.ok(file, 'preserved file exists');
});

test('Internet Archive stores the returned snapshot link', async () => {
  const b = svc.createBookmark({ address: 'https://example.org/ia', title: 'IA' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    url: 'https://web.archive.org/web/20260101000000/https://example.org/ia',
    headers: { get: (h) => (h.toLowerCase() === 'content-location' ? '/web/20260101000000/https://example.org/ia' : null) },
  });
  try {
    const updated = await preservation.preserveToInternetArchive(b.id);
    assert.match(updated.archiveOrgUrl, /web\.archive\.org\/web\/20260101000000/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Internet Archive failure leaves the bookmark intact', async () => {
  const b = svc.createBookmark({ address: 'https://example.org/ia-fail', title: 'IA fail' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  try {
    await assert.rejects(() => preservation.preserveToInternetArchive(b.id), (e) => e.status === 502);
    const still = svc.getBookmark(b.id);
    assert.equal(still.archiveOrgUrl, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
