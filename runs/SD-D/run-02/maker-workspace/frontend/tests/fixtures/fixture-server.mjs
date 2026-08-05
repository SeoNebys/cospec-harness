/**
 * Tiny fixture web server for E2E tests. Serves deterministic pages (with Open
 * Graph tags + an image) so the backend's metadata fetch and snapshot capture
 * have a stable, offline target — no dependency on the live internet.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.FIXTURE_PORT ?? 4600);

// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const article = (title, desc) => `<!doctype html><html><head>
<meta charset="utf-8">
<title>${title} (raw)</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="/preview.png">
<link rel="icon" href="/favicon.png">
</head><body>
<article><h1>${title}</h1><p>${desc}</p>
<p>This is the readable body of the fixture article, long enough for extraction.</p></article>
</body></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/preview.png' || url.pathname === '/favicon.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PNG);
  }
  if (url.pathname === '/article') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(article('The Great Fixture Article', 'A dependable page for tests.'));
  }
  if (url.pathname === '/second') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(article('Second Fixture Page', 'Another dependable page.'));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fixture server on http://127.0.0.1:${PORT}`);
});
