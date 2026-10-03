import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkStore, parseWebAddress } from './store.mjs';
import { retrievePageMetadata } from './metadata.mjs';

const implementationRoot = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(implementationRoot, 'public');
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
const dataFile = process.env.TUCK_DATA_FILE ?? join(implementationRoot, 'data', 'bookmarks.json');
const store = new BookmarkStore(dataFile);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Request is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function apiRoute(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/bookmarks') {
    sendJson(response, 200, { bookmarks: await store.list(), tags: await store.tagSuggestions() });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/tags') {
    sendJson(response, 200, { tags: await store.tagSuggestions(url.searchParams.get('q') ?? '') });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/metadata') {
    try {
      const address = parseWebAddress(url.searchParams.get('url')).href;
      const metadata = await retrievePageMetadata(address);
      sendJson(response, 200, { metadata });
    } catch (error) {
      sendJson(response, 422, { error: 'We couldn’t load this page’s details. You can still save the link.' });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/bookmarks') {
    try {
      const result = await store.create(await readJson(request));
      sendJson(response, result.created ? 201 : 409, result);
    } catch (error) {
      sendJson(response, 422, { error: error.message || 'The bookmark could not be saved' });
    }
    return true;
  }

  const titleMatch = url.pathname.match(/^\/api\/bookmarks\/([^/]+)$/);
  if (request.method === 'PATCH' && titleMatch) {
    try {
      const body = await readJson(request);
      const bookmark = await store.updateTitle(decodeURIComponent(titleMatch[1]), body.title);
      if (!bookmark) sendJson(response, 404, { error: 'Bookmark not found' });
      else sendJson(response, 200, { bookmark });
    } catch (error) {
      sendJson(response, 422, { error: error.message || 'The bookmark could not be updated' });
    }
    return true;
  }

  if (request.method === 'DELETE' && titleMatch) {
    const bookmark = await store.remove(decodeURIComponent(titleMatch[1]));
    if (!bookmark) sendJson(response, 404, { error: 'Bookmark not found' });
    else sendJson(response, 200, { bookmark, undoWindowMs: store.undoWindowMs });
    return true;
  }

  const restoreMatch = url.pathname.match(/^\/api\/bookmarks\/([^/]+)\/restore$/);
  if (request.method === 'POST' && restoreMatch) {
    const bookmark = await store.restore(decodeURIComponent(restoreMatch[1]));
    if (!bookmark) sendJson(response, 410, { error: 'The Undo window has ended' });
    else sendJson(response, 200, { bookmark });
    return true;
  }

  return false;
}

async function serveStatic(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(publicRoot, safePath);
  if (!filePath.startsWith(publicRoot)) return false;
  try {
    const contents = await readFile(filePath);
    response.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff'
    });
    response.end(contents);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      if (!(await apiRoute(request, response, url))) sendJson(response, 404, { error: 'Not found' });
      return;
    }
    if (!(await serveStatic(response, url.pathname))) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: 'Something went wrong' });
    else response.end();
  }
});

server.listen(port, host, () => {
  console.log(`Tuck is listening on http://${host}:${port}`);
});

export { server, store };
