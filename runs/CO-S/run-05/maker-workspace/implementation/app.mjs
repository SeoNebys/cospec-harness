import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPageDetails, fallbackDetails, validateWebAddress } from './lib/metadata.mjs';

const publicDirectory = fileURLToPath(new URL('./public/', import.meta.url));
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon']
]);

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 100_000) throw Object.assign(new Error('Request is too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON'), { status: 400 });
  }
}

function integerId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const path = join(publicDirectory, safe);
  if (!path.startsWith(publicDirectory)) return false;
  try {
    const content = await readFile(path);
    response.writeHead(200, {
      'content-type': types.get(extname(path)) || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    response.end(content);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return false;
    throw error;
  }
}

export function createHttpServer({ store, metadataLoader = fetchPageDetails }) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://app.local');
      const { pathname } = url;

      if (request.method === 'GET' && pathname === '/api/bookmarks') {
        const view = ['all', 'later', 'archive'].includes(url.searchParams.get('view')) ? url.searchParams.get('view') : 'all';
        return sendJson(response, 200, { bookmarks: store.list({ view, query: url.searchParams.get('q') || '' }) });
      }

      if (request.method === 'POST' && pathname === '/api/bookmarks') {
        const body = await readJson(request);
        let address;
        try {
          address = validateWebAddress(body.url);
        } catch (error) {
          return sendJson(response, 422, { error: error.message, field: 'url' });
        }
        const existing = store.getByUrl(address);
        if (existing) return sendJson(response, 409, { error: 'This bookmark is already in your collection, so another copy wasn’t added.', bookmark: existing });
        let details;
        let detailsStatus = 'ready';
        try {
          details = await metadataLoader(address);
        } catch {
          details = fallbackDetails(address);
          detailsStatus = 'needs_details';
        }
        const bookmark = store.add({ url: address, ...details, detailsStatus });
        return sendJson(response, 201, { bookmark });
      }

      let match = pathname.match(/^\/api\/bookmarks\/(\d+)\/labels$/);
      if (request.method === 'POST' && match) {
        const id = integerId(match[1]);
        const body = await readJson(request);
        const result = store.addLabel(id, String(body.name ?? ''));
        if (result.kind === 'missing') return sendJson(response, 404, { error: 'Bookmark not found' });
        if (result.kind === 'invalid') return sendJson(response, 422, { error: 'Enter a label' });
        if (result.kind === 'duplicate') return sendJson(response, 409, { error: 'This bookmark already has that label.', bookmark: result.bookmark });
        return sendJson(response, 201, { bookmark: result.bookmark });
      }

      match = pathname.match(/^\/api\/bookmarks\/(\d+)\/retry-details$/);
      if (request.method === 'POST' && match) {
        const id = integerId(match[1]);
        const bookmark = store.get(id);
        if (!bookmark) return sendJson(response, 404, { error: 'Bookmark not found' });
        try {
          const details = await metadataLoader(bookmark.url);
          return sendJson(response, 200, { bookmark: store.replaceCollectedDetails(id, details) });
        } catch {
          return sendJson(response, 502, { error: 'The page details are still unavailable. Try again later.', bookmark });
        }
      }

      match = pathname.match(/^\/api\/bookmarks\/(\d+)$/);
      if (request.method === 'PATCH' && match) {
        const id = integerId(match[1]);
        const current = store.get(id);
        if (!current) return sendJson(response, 404, { error: 'Bookmark not found' });
        const body = await readJson(request);
        let bookmark = current;
        if (typeof body.archived === 'boolean') bookmark = store.setArchived(id, body.archived);
        if (typeof body.readLater === 'boolean') bookmark = store.setReadLater(id, body.readLater);
        if (typeof body.title === 'string' || typeof body.description === 'string') {
          const title = typeof body.title === 'string' ? body.title.trim() : bookmark.title;
          if (!title) return sendJson(response, 422, { error: 'Title cannot be empty', field: 'title' });
          bookmark = store.editDetails(id, { title, description: body.description });
        }
        return sendJson(response, 200, { bookmark });
      }

      if (pathname.startsWith('/api/')) return sendJson(response, 404, { error: 'Not found' });
      if (request.method === 'GET' && await serveStatic(pathname, response)) return;
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      console.error(error);
      sendJson(response, error.status || 500, { error: error.status ? error.message : 'Something went wrong' });
    }
  });
}
