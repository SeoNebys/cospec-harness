import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkStore, filterBookmarks, normalizeAddress } from './lib/store.mjs';
import { collectMetadata } from './lib/metadata.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(root, 'public');
const dataFile = process.env.KEEPWELL_DATA_FILE || join(root, 'data', 'bookmarks.json');
const store = new BookmarkStore(dataFile);
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('BODY_TOO_LARGE');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('BAD_JSON'); }
}

function errorResponse(response, error) {
  const codes = { INVALID_URL: 400, BAD_JSON: 400, BODY_TOO_LARGE: 413, NOT_FOUND: 404, TAG_REQUIRED: 400, INVALID_ACTION: 400 };
  const messages = {
    INVALID_URL: 'Please enter a complete web address, such as https://example.com',
    NOT_FOUND: 'That bookmark no longer exists.',
    TAG_REQUIRED: 'Choose or create a tag first.',
    INVALID_ACTION: 'That bulk action is not supported.'
  };
  json(response, codes[error.message] || 500, { error: messages[error.message] || 'Something went wrong. Please try again.' });
}

async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/bookmarks') {
    const all = await store.all();
    const filters = { view: url.searchParams.get('view') || 'all', query: url.searchParams.get('q') || '', tag: url.searchParams.get('tag') || '', sort: url.searchParams.get('sort') || 'added' };
    const bookmarks = filterBookmarks(all, filters);
    const counts = { all: all.filter((item) => !item.archived).length, readLater: all.filter((item) => !item.archived && item.readLater).length, archive: all.filter((item) => item.archived).length };
    return json(response, 200, { bookmarks, counts, tags: await store.tags() });
  }

  if (request.method === 'POST' && url.pathname === '/api/bookmarks') {
    const input = await body(request);
    const normalized = normalizeAddress(input.url);
    const existing = await store.findByAddress(normalized);
    if (existing) return json(response, 200, { bookmark: existing, duplicate: true });
    let metadata;
    let enrichment = 'complete';
    try { metadata = await collectMetadata(normalized); }
    catch {
      const domain = new URL(normalized).hostname.replace(/^www\./, '');
      metadata = { title: domain, description: '', siteName: domain, imageUrl: '', iconUrl: '' };
      enrichment = 'fallback';
    }
    const result = await store.create({ url: normalized, ...metadata, enrichment });
    return json(response, 201, result);
  }

  const itemMatch = url.pathname.match(/^\/api\/bookmarks\/([a-f0-9-]+)$/i);
  if (itemMatch && request.method === 'PATCH') return json(response, 200, { bookmark: await store.update(itemMatch[1], await body(request)) });
  if (itemMatch && request.method === 'DELETE') return json(response, 200, { bookmark: await store.remove(itemMatch[1]) });
  const retryMatch = url.pathname.match(/^\/api\/bookmarks\/([a-f0-9-]+)\/retry$/i);
  if (retryMatch && request.method === 'POST') {
    const current = (await store.all()).find((item) => item.id === retryMatch[1]);
    if (!current) throw new Error('NOT_FOUND');
    try {
      const metadata = await collectMetadata(current.url);
      return json(response, 200, { bookmark: await store.update(current.id, { ...metadata, enrichment: 'complete' }) });
    } catch { return json(response, 422, { error: 'Page details are still unavailable. Try again later.' }); }
  }

  if (request.method === 'POST' && url.pathname === '/api/bulk') {
    const input = await body(request);
    if (!Array.isArray(input.ids) || input.ids.length === 0) return json(response, 400, { error: 'Select at least one bookmark.' });
    return json(response, 200, await store.bulk(input.ids, input.action, input.tag));
  }
  return json(response, 404, { error: 'Not found.' });
}

async function staticFile(response, url) {
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const path = join(publicRoot, safe);
  if (!path.startsWith(publicRoot)) return json(response, 404, { error: 'Not found.' });
  try {
    const content = await readFile(path);
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': extname(path) === '.html' ? 'no-store' : 'public, max-age=300' });
    response.end(content);
  } catch { json(response, 404, { error: 'Not found.' }); }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/')) await api(request, response, url);
      else await staticFile(response, url);
    } catch (error) { errorResponse(response, error); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(port, host, () => console.log(`Keepwell listening on http://${host}:${port}`));
}
