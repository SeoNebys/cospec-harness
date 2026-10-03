import { createServer as createHttpServer } from 'node:http';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkStore, DuplicateBookmarkError } from './lib/store.js';
import { fetchPageDetails } from './lib/metadata.js';
import { InvalidAddressError, canonicalizeAddress, cleanDisplayAddress, websiteName } from './lib/urls.js';
import { SearchSyntaxError } from './lib/search.js';

const implementationRoot = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(implementationRoot, 'public');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  response.end(body);
}

function sendText(response, status, value, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'content-type': contentType,
    'content-length': Buffer.byteLength(value),
    'cache-control': 'no-store'
  });
  response.end(value);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Request must contain valid JSON.');
  }
}

function serveStatic(pathname, response) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const relative = normalize(requested).replace(/^[/\\]+/, '');
  const filePath = join(publicRoot, relative);
  if (!filePath.startsWith(publicRoot) || !existsSync(filePath)) return false;
  const body = readFileSync(filePath);
  response.writeHead(200, {
    'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-cache'
  });
  response.end(body);
  return true;
}

function fixturePage(url) {
  const title = url.searchParams.get('title') || 'Fixture Page';
  const description = url.searchParams.get('description') || 'A fixture description for acceptance testing.';
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}"><link rel="icon" href="/favicon.svg"></head><body>${title}</body></html>`;
}

function errorResponse(response, error) {
  if (error instanceof InvalidAddressError) {
    sendJson(response, 400, { error: error.message, code: 'invalid_address' });
    return;
  }
  if (error instanceof SearchSyntaxError) {
    sendJson(response, 400, { error: error.message, code: 'search_syntax' });
    return;
  }
  if (error instanceof DuplicateBookmarkError) {
    sendJson(response, 409, { error: error.message, code: 'duplicate', existing: error.bookmark });
    return;
  }
  const status = /title|JSON|large/i.test(error.message) ? 400 : 500;
  sendJson(response, status, { error: error.message || 'Something went wrong.' });
}

export function createTroveServer({
  dbPath = join(implementationRoot, 'data', 'trove.db'),
  metadataFetcher = fetchPageDetails,
  enableFixtures = false
} = {}) {
  const store = new BookmarkStore(dbPath);

  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const pathname = url.pathname;

    try {
      if (enableFixtures && request.method === 'GET' && pathname === '/__fixtures/page') {
        sendText(response, 200, fixturePage(url), 'text/html; charset=utf-8');
        return;
      }
      if (enableFixtures && request.method === 'GET' && pathname === '/__fixtures/unavailable') {
        sendText(response, 403, 'Unavailable');
        return;
      }
      if (enableFixtures && request.method === 'POST' && pathname === '/__fixtures/reset') {
        store.reset();
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && pathname === '/health') {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/overview') {
        sendJson(response, 200, store.overview());
        return;
      }

      if (request.method === 'GET' && pathname === '/api/bookmarks') {
        const result = store.list({
          view: url.searchParams.get('view') || 'all',
          query: url.searchParams.get('q') || '',
          offset: url.searchParams.get('offset') || 0,
          limit: url.searchParams.get('limit') || 20
        });
        sendJson(response, 200, { ...result, overview: store.overview() });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/metadata') {
        const input = await readJson(request);
        const address = cleanDisplayAddress(input.url);
        const existing = store.findByAddress(address);
        if (existing) {
          sendJson(response, 200, {
            duplicate: existing,
            trackingIgnored: canonicalizeAddress(input.url) === existing.canonicalUrl && address !== existing.url
          });
          return;
        }
        const details = await metadataFetcher(address);
        sendJson(response, 200, {
          ...details,
          url: address,
          canonicalUrl: canonicalizeAddress(address),
          siteName: details.siteName || websiteName(address)
        });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/bookmarks') {
        const bookmark = store.create(await readJson(request));
        sendJson(response, 201, { bookmark, overview: store.overview() });
        return;
      }

      const bookmarkMatch = pathname.match(/^\/api\/bookmarks\/(\d+)$/);
      if (bookmarkMatch && request.method === 'GET') {
        const bookmark = store.get(bookmarkMatch[1]);
        if (!bookmark) {
          sendJson(response, 404, { error: 'Bookmark not found.' });
          return;
        }
        sendJson(response, 200, { bookmark });
        return;
      }

      if (bookmarkMatch && request.method === 'PATCH') {
        const bookmark = store.update(bookmarkMatch[1], await readJson(request));
        if (!bookmark) {
          sendJson(response, 404, { error: 'Bookmark not found.' });
          return;
        }
        sendJson(response, 200, { bookmark, overview: store.overview() });
        return;
      }

      if (bookmarkMatch && request.method === 'DELETE') {
        if (!store.delete(bookmarkMatch[1])) {
          sendJson(response, 404, { error: 'Bookmark not found.' });
          return;
        }
        sendJson(response, 200, { deleted: true, overview: store.overview() });
        return;
      }

      if (request.method === 'GET' && !pathname.startsWith('/api/')) {
        if (serveStatic(pathname, response)) return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      errorResponse(response, error);
    }
  });

  server.on('close', () => store.close());
  return { server, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dbPath = process.env.TROVE_DB_PATH || join(implementationRoot, 'data', 'trove.db');
  if (process.env.TROVE_RESET_DB === '1' && dbPath !== ':memory:' && existsSync(dbPath)) rmSync(dbPath);
  const port = Number(process.env.PORT || 4000);
  const { server } = createTroveServer({
    dbPath,
    enableFixtures: process.env.TROVE_ENABLE_TEST_FIXTURES === '1'
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Trove listening on http://0.0.0.0:${port}`);
  });
}
