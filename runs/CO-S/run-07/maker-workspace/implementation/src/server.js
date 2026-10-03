const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { BookmarkStore, StoreError } = require('./store');
const { fetchMetadata } = require('./metadata');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DEFAULT_DATA_FILE = path.join(__dirname, '..', 'data', 'bookmarks.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  response.end(payload);
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error('Request is too large.'), { code: 'TOO_LARGE' });
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { code: 'INVALID_JSON' });
  }
}

function errorResponse(response, error) {
  if (error instanceof StoreError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'DUPLICATE' ? 409 : 400;
    return json(response, status, { error: error.message, code: error.code, existing: error.existing || undefined });
  }
  if (error.code === 'INVALID_URL') return json(response, 400, { error: error.message, code: error.code });
  if (error.code === 'DETAILS_UNAVAILABLE') return json(response, 422, { error: error.message, code: error.code });
  if (['TOO_LARGE', 'INVALID_JSON'].includes(error.code)) return json(response, 400, { error: error.message, code: error.code });
  console.error(error);
  return json(response, 500, { error: 'Something went wrong. Your changes were not saved.', code: 'SERVER_ERROR' });
}

function sendStatic(requestPath, response) {
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, relative);
  if (!resolved.startsWith(`${path.resolve(PUBLIC_DIR)}${path.sep}`) && resolved !== path.join(PUBLIC_DIR, 'index.html')) {
    response.writeHead(404).end('Not found');
    return;
  }
  const file = fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : path.join(PUBLIC_DIR, 'index.html');
  const content = fs.readFileSync(file);
  response.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'content-length': content.length,
    'cache-control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=300',
  });
  response.end(content);
}

function createApp({ store, metadataFetcher = fetchMetadata } = {}) {
  const bookmarkStore = store || new BookmarkStore(process.env.BOOKMARK_DATA_FILE || DEFAULT_DATA_FILE);
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    const pathname = requestUrl.pathname;
    try {
      if (request.method === 'GET' && pathname === '/api/bookmarks') {
        return json(response, 200, { bookmarks: bookmarkStore.list() });
      }
      if (request.method === 'POST' && pathname === '/api/metadata') {
        const body = await readJson(request);
        const metadata = await metadataFetcher(body.url);
        return json(response, 200, metadata);
      }
      if (request.method === 'POST' && pathname === '/api/bookmarks') {
        const bookmark = bookmarkStore.create(await readJson(request));
        return json(response, 201, { bookmark });
      }
      const bookmarkMatch = pathname.match(/^\/api\/bookmarks\/([^/]+)$/);
      if (bookmarkMatch && request.method === 'PUT') {
        const bookmark = bookmarkStore.update(decodeURIComponent(bookmarkMatch[1]), await readJson(request));
        return json(response, 200, { bookmark });
      }
      if (bookmarkMatch && request.method === 'DELETE') {
        const bookmark = bookmarkStore.remove(decodeURIComponent(bookmarkMatch[1]));
        return json(response, 200, { bookmark });
      }
      const readLaterMatch = pathname.match(/^\/api\/bookmarks\/([^/]+)\/read-later$/);
      if (readLaterMatch && request.method === 'PATCH') {
        const body = await readJson(request);
        const bookmark = bookmarkStore.setReadLater(decodeURIComponent(readLaterMatch[1]), body.isReadLater);
        return json(response, 200, { bookmark });
      }
      if (pathname.startsWith('/api/')) return json(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
      sendStatic(pathname, response);
    } catch (error) {
      errorResponse(response, error);
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  const server = createApp();
  server.listen(port, '0.0.0.0', () => console.log(`Pocketmark listening on http://0.0.0.0:${port}`));
}

module.exports = { createApp, readJson };
