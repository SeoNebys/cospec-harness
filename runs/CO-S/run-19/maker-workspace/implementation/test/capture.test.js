import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { CaptureError, capturePage } from '../src/capture.js';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('capture stores page identity, meaningful text, dates, and embedded images as a frozen copy', async (t) => {
  let articleText = 'The original observations remain readable.';
  const server = http.createServer((request, response) => {
    if (request.url === '/image.png') {
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(pixel);
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><html><head>
      <title>Fallback title</title>
      <meta property="og:title" content="The surprising intelligence of octopuses">
      <meta name="description" content="How octopuses solve complex puzzles.">
      <meta property="og:site_name" content="Natural Review">
      <meta name="author" content="Mira Wells">
      <meta property="article:published_time" content="2025-03-02">
      <meta property="og:image" content="/image.png">
    </head><body><nav>Remove me</nav><article><h1>Octopus minds</h1><p>${articleText}</p><img src="/image.png"></article><script>alert(1)</script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = `http://127.0.0.1:${server.address().port}/article`;
  const captured = await capturePage(address, { allowPrivate: true });
  assert.equal(captured.title, 'The surprising intelligence of octopuses');
  assert.equal(captured.description, 'How octopuses solve complex puzzles.');
  assert.equal(captured.siteName, 'Natural Review');
  assert.equal(captured.author, 'Mira Wells');
  assert.equal(captured.publishedAt, '2025-03-02');
  assert.match(captured.previewImage, /^data:image\/png;base64,/);
  assert.match(captured.contentHtml, /The original observations remain readable/);
  assert.match(captured.contentHtml, /data:image\/png;base64,/);
  assert.doesNotMatch(captured.contentHtml, /script|Remove me|alert/);
  articleText = 'A later live-page revision.';
  assert.match(captured.contentHtml, /original observations/);
  assert.doesNotMatch(captured.contentHtml, /later live-page revision/);
});

test('unreachable pages fail without manufacturing a bookmark payload', async () => {
  await assert.rejects(
    capturePage('http://127.0.0.1:1/unavailable', { allowPrivate: true }),
    (error) => error instanceof CaptureError && error.code === 'capture_failed',
  );
});
