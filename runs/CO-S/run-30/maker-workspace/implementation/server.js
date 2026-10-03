import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './lib/errors.js';
import { BookmarkStore } from './lib/store.js';
import { MetadataClient } from './lib/metadata.js';
import { BookmarkService } from './lib/bookmarks.js';

const implementationRoot = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(implementationRoot, 'public');
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 64_000) throw new AppError('BODY_TOO_LARGE', 'Request is too large.', 413);
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new AppError('INVALID_JSON', 'Request body is invalid.', 400);
  }
}

async function handleApi(request, response, url, service) {
  if (request.method === 'GET' && url.pathname === '/api/bookmarks') {
    return json(response, 200, { bookmarks: service.list() });
  }

  if (request.method === 'POST' && url.pathname === '/api/bookmarks') {
    const result = await service.save(await readJson(request));
    return json(response, result.kind === 'created' ? 201 : 409, result);
  }

  const route = url.pathname.match(/^\/api\/bookmarks\/(\d+)\/(refresh|labels|read-status|archive|restore|restore-refresh)$/);
  if (request.method === 'POST' && route) {
    const [, id, action] = route;
    let result;
    if (action === 'refresh') result = await service.refresh(id);
    if (action === 'labels') result = await service.addLabel(id, (await readJson(request)).label);
    if (action === 'read-status') result = await service.setRead(id, (await readJson(request)).read);
    if (action === 'archive') result = await service.archive(id);
    if (action === 'restore') result = await service.restore(id);
    if (action === 'restore-refresh') result = await service.restoreAndRefresh(id);
    return json(response, 200, result);
  }

  throw new AppError('NOT_FOUND', 'Not found.', 404);
}

async function serveStatic(response, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const filePath = resolve(publicRoot, relativePath);
  if (!filePath.startsWith(`${resolve(publicRoot)}/`) && filePath !== resolve(publicRoot, 'index.html')) {
    throw new AppError('NOT_FOUND', 'Not found.', 404);
  }
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'content-type': MIME_TYPES.get(extname(filePath)) ?? 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') throw new AppError('NOT_FOUND', 'Not found.', 404);
    throw error;
  }
}

export function createRequestHandler(service) {
  return async (request, response) => {
    try {
      const url = new URL(request.url, 'http://bookmark.local');
      if (url.pathname.startsWith('/api/')) await handleApi(request, response, url, service);
      else await serveStatic(response, url.pathname);
    } catch (error) {
      if (error instanceof AppError) return json(response, error.status, { error: error.code, message: error.message, ...error.details });
      console.error(error);
      return json(response, 500, { error: 'INTERNAL_ERROR', message: 'Something went wrong.' });
    }
  };
}

export async function startServer({ port = Number(process.env.PORT ?? 4000), host = process.env.HOST ?? '0.0.0.0', dataFile = process.env.BOOKMARK_DATA_FILE ?? join(implementationRoot, 'data', 'bookmarks.json') } = {}) {
  const store = await BookmarkStore.open(dataFile);
  const service = new BookmarkService({ store, metadataClient: new MetadataClient() });
  const server = createServer(createRequestHandler(service));
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolveListen);
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then((server) => {
    const address = server.address();
    console.log(`Bookmark Library listening on http://${address.address}:${address.port}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
