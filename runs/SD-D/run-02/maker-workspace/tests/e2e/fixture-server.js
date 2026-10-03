import http from 'node:http';

// A tiny local server that serves predictable HTML pages and a PDF, so E2E tests
// exercise metadata capture and snapshots without depending on the internet.
export function startFixtureServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/page') {
      const n = url.searchParams.get('n') || '1';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head>
        <title>Fixture Page ${n}</title>
        <meta property="og:title" content="Fixture Page ${n}">
        <meta property="og:description" content="Description for fixture ${n}.">
      </head><body><h1>Fixture Page ${n}</h1>
      <p>Unique marker content zebra-${n} on this page.</p></body></html>`);
    } else if (url.pathname === '/doc.pdf') {
      const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(pdf);
    } else {
      res.writeHead(404);
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
