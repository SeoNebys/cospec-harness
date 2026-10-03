import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../server.mjs';

const pageHtml = (title = 'Designing for Readers', description = 'Practical ways to make reading on the web clearer, calmer, and more rewarding.') => `<!doctype html>
<html><head>
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="/preview.png">
  <link rel="icon" href="/favicon.ico">
</head><body><nav>Ignore navigation</nav><article>
  <h1>${title}</h1>
  <p>Reading is one of the web’s most familiar activities, but thoughtful reading experiences rarely happen by accident.</p>
  <p>Good typography, measured line lengths, and a calm visual rhythm help ideas reach the people they were written for.</p>
</article></body></html>`;

export async function startFixtureServer() {
  const status = { article: true, flaky: false };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/article' && status.article) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return response.end(request.method === 'HEAD' ? '' : pageHtml());
    }
    if (url.pathname === '/humane') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return response.end(request.method === 'HEAD' ? '' : pageHtml('Attention Is a Design Material', 'Building humane interfaces for busy digital spaces.'));
    }
    if (url.pathname === '/deep-work') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return response.end(request.method === 'HEAD' ? '' : pageHtml('A Field Guide to Deep Work', 'Practical routines for sustained concentration.'));
    }
    if (url.pathname === '/flaky' && status.flaky) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return response.end(request.method === 'HEAD' ? '' : pageHtml('Recovered Article'));
    }
    if (url.pathname === '/preview.png' || url.pathname === '/favicon.ico') {
      response.writeHead(200, { 'content-type': 'image/png' });
      return response.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
    }
    response.writeHead(503, { 'content-type': 'text/plain' });
    response.end('Unavailable');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    status,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

export async function startTestApp() {
  const fixture = await startFixtureServer();
  const directory = await mkdtemp(join(tmpdir(), 'trove-test-'));
  const app = await startServer({ port: 0, host: '127.0.0.1', dataFile: join(directory, 'bookmarks.json'), retryIntervalMs: 0 });
  return {
    fixture,
    app,
    close: async () => {
      await app.close();
      await fixture.close();
      await rm(directory, { recursive: true, force: true });
    }
  };
}

export async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}
