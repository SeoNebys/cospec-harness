import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkError, BookmarkService } from './lib/bookmarks.js';
import { JsonStore } from './lib/store.js';

const implementationDir = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(implementationDir, 'public');
const seed = JSON.parse(await readFile(join(implementationDir, 'data', 'seed.json'), 'utf8'));
const dataFile = process.env.DATA_FILE || join(implementationDir, 'data', 'bookmarks.json');
const store = new JsonStore(dataFile, seed);
await store.initialize();
const service = new BookmarkService(store);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.json', 'application/json; charset=utf-8']
]);

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new BookmarkError('Request is too large.', 413, 'TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BookmarkError('Request must be valid JSON.', 400, 'INVALID_JSON');
  }
}

async function api(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/state') return json(response, 200, await service.state());
  if (request.method === 'POST' && pathname === '/api/bookmarks') {
    const payload = await body(request);
    return json(response, 201, await service.add(payload.url));
  }
  const match = pathname.match(/^\/api\/bookmarks\/([^/]+)(\/retry)?$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (request.method === 'PATCH' && !match[2]) return json(response, 200, await service.update(id, await body(request)));
    if (request.method === 'DELETE' && !match[2]) return json(response, 200, { deleted: await service.delete(id) });
    if (request.method === 'POST' && match[2]) return json(response, 200, await service.retryMetadata(id));
  }
  if (process.env.NODE_ENV === 'test' && request.method === 'POST' && pathname === '/api/test/reset') {
    await store.reset();
    return json(response, 200, await service.state());
  }
  return json(response, 404, { error: 'Not found', code: 'NOT_FOUND' });
}

async function staticFile(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  const path = join(publicDir, safe);
  if (!path.startsWith(publicDir)) return false;
  try {
    const content = await readFile(path);
    response.writeHead(200, { 'content-type': mimeTypes.get(extname(path)) || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(content);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://local');
      if (url.pathname.startsWith('/api/')) return await api(request, response, url.pathname);
      if (await staticFile(response, url.pathname)) return;
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    } catch (error) {
      const status = error instanceof BookmarkError ? error.status : 500;
      json(response, status, { error: status === 500 ? 'Something went wrong.' : error.message, code: error.code || 'INTERNAL_ERROR' });
      if (status === 500) console.error(error);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  createServer().listen(port, '0.0.0.0', () => console.log(`Keep is listening on http://0.0.0.0:${port}`));
}
