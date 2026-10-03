import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkStore } from './lib/store.js';
import { canonicalAddress, fallbackTitle, prepareAddress } from './lib/url.js';
import { fetchPageDetails } from './lib/metadata.js';
import { searchBookmarks } from './lib/search.js';
import { normalizeTags } from './lib/tags.js';

const implementationRoot = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(implementationRoot, 'public');
const defaultDataFile = process.env.BOOKMARK_DATA_FILE || join(implementationRoot, 'data', 'bookmarks.json');

export async function createBookmarkServer(options = {}) {
  const store = options.store ?? new BookmarkStore(options.dataFile ?? defaultDataFile);
  const metadataFetcher = options.metadataFetcher ?? fetchPageDetails;
  await store.init();

  const server = createServer(async (request, response) => {
    try {
      await route(request, response, { store, metadataFetcher });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: 'Something went wrong. Your saved bookmarks were not changed.' });
    }
  });
  return { server, store };
}

async function route(request, response, services) {
  const origin = `http://${request.headers.host || 'localhost'}`;
  const url = new URL(request.url, origin);

  if (url.pathname === '/api/bookmarks' && request.method === 'GET') {
    const bookmarks = (await services.store.all()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const search = searchBookmarks(bookmarks, url.searchParams.get('q') ?? '');
    return sendJson(response, 200, search);
  }

  if (url.pathname === '/api/bookmarks' && request.method === 'POST') {
    return createBookmark(request, response, services);
  }

  const bookmarkMatch = url.pathname.match(/^\/api\/bookmarks\/([a-f\d-]+)$/i);
  if (bookmarkMatch && request.method === 'GET') {
    const bookmark = await services.store.findById(bookmarkMatch[1]);
    return bookmark ? sendJson(response, 200, { bookmark }) : sendJson(response, 404, { error: 'Bookmark not found.' });
  }

  if (bookmarkMatch && request.method === 'PUT') {
    return updateBookmark(bookmarkMatch[1], request, response, services);
  }

  if (url.pathname === '/api/tags' && request.method === 'GET') {
    const bookmarks = await services.store.all();
    return sendJson(response, 200, { tags: normalizeTags(bookmarks.flatMap(bookmark => bookmark.tags)) });
  }

  if (request.method === 'GET' || request.method === 'HEAD') return serveStatic(url.pathname, request, response);
  sendJson(response, 404, { error: 'Not found.' });
}

async function createBookmark(request, response, { store, metadataFetcher }) {
  const body = await readJson(request);
  const prepared = prepareAddress(body.address);
  if (!prepared.ok) return sendJson(response, 400, { error: prepared.message, field: 'address' });

  const canonical = canonicalAddress(prepared.address);
  const existing = await store.findByCanonical(canonical);
  if (existing) return sendJson(response, 200, { outcome: 'existing', bookmark: existing });

  let details;
  let detailsAvailable = true;
  try {
    details = await metadataFetcher(prepared.address);
  } catch {
    detailsAvailable = false;
    details = { title: '', description: '', previewUrl: null, iconUrl: null, siteName: new URL(prepared.address).hostname.replace(/^www\./, '') };
  }

  const allTags = (await store.all()).flatMap(bookmark => bookmark.tags);
  const bookmark = await store.create({
    address: prepared.address,
    canonicalAddress: canonical,
    title: details.title || fallbackTitle(prepared.address),
    description: details.description || '',
    notes: '',
    tags: normalizeTags([], allTags),
    siteName: details.siteName || new URL(prepared.address).hostname.replace(/^www\./, ''),
    iconUrl: details.iconUrl || null,
    previewUrl: details.previewUrl || null,
    detailsAvailable
  });
  sendJson(response, 201, { outcome: detailsAvailable ? 'created' : 'created-basic', bookmark });
}

async function updateBookmark(id, request, response, { store }) {
  const current = await store.findById(id);
  if (!current) return sendJson(response, 404, { error: 'Bookmark not found.' });
  const body = await readJson(request);
  const prepared = prepareAddress(body.address);
  if (!prepared.ok) return sendJson(response, 400, { error: prepared.message, field: 'address' });

  const canonical = canonicalAddress(prepared.address);
  const collision = await store.findByCanonical(canonical);
  if (collision && collision.id !== id) {
    return sendJson(response, 409, { error: 'Another saved bookmark already uses this address.', existingId: collision.id, field: 'address' });
  }

  const established = (await store.all()).flatMap(bookmark => bookmark.tags);
  const updated = await store.update(id, {
    address: prepared.address,
    canonicalAddress: canonical,
    title: cleanSingleLine(body.title) || fallbackTitle(prepared.address),
    description: cleanText(body.description),
    notes: limitText(body.notes, 100_000),
    tags: normalizeTags(Array.isArray(body.tags) ? body.tags : [], established)
  });
  sendJson(response, 200, { bookmark: updated });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

async function serveStatic(pathname, request, response) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(publicRoot, safe);
  if (!filePath.startsWith(publicRoot)) return sendJson(response, 404, { error: 'Not found.' });
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeType(filePath),
      'content-length': body.length,
      'cache-control': 'no-cache',
      'content-security-policy': "default-src 'self'; img-src 'self' https: http: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
    });
    if (request.method === 'HEAD') return response.end();
    response.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'Not found.' });
    throw error;
  }
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  response.end(body);
}

function cleanSingleLine(value) {
  return limitText(value, 500).replace(/\s+/g, ' ').trim();
}

function cleanText(value) {
  return limitText(value, 10_000).trim();
}

function limitText(value, max) {
  return String(value ?? '').slice(0, max);
}

function mimeType(filePath) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
  })[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  const host = process.env.HOST || '0.0.0.0';
  const { server } = await createBookmarkServer();
  server.listen(port, host, () => console.log(`Bookmarks is ready on http://${host}:${port}`));
}
