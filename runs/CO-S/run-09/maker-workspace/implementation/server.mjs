import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  allKnownTags,
  applyCapturedPage,
  canonicalizeUrl,
  createBookmark,
  fetchPage,
  matchesSearch,
  parseWebUrl,
  sourceFromUrl,
  updateBookmark
} from './src/bookmarks.mjs';
import { BookmarkStore } from './src/store.mjs';

const IMPLEMENTATION_DIR = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(IMPLEMENTATION_DIR, 'public');
const DEFAULT_DATA_FILE = join(IMPLEMENTATION_DIR, 'data', 'bookmarks.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function json(response, status, value) {
  const payload = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store'
  });
  response.end(payload);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function publicBookmark(bookmark) {
  return {
    ...bookmark,
    archive: {
      status: bookmark.archive?.status ?? 'pending',
      capturedAt: bookmark.archive?.capturedAt ?? null,
      paragraphCount: bookmark.archive?.body?.length ?? 0
    }
  };
}

function findByCanonical(bookmarks, address) {
  const canonical = canonicalizeUrl(address);
  return bookmarks.find(item => item.canonicalUrl === canonical) ?? null;
}

async function checkReachable(address, fetchImpl, timeoutMs = 4_500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    let response = await fetchImpl(address, {
      method: 'HEAD', redirect: 'follow', signal: controller.signal,
      headers: { 'user-agent': 'TroveBookmarkLibrary/1.0' }
    });
    if ([403, 405].includes(response.status)) {
      response = await fetchImpl(address, {
        method: 'GET', redirect: 'follow', signal: controller.signal,
        headers: { 'user-agent': 'TroveBookmarkLibrary/1.0', range: 'bytes=0-1024' }
      });
    }
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const file = resolve(PUBLIC_DIR, `.${safePath}`);
  if (!file.startsWith(resolve(PUBLIC_DIR))) return false;
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'content-length': body.length,
      'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    response.end(body);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return false;
    throw error;
  }
}

export async function startServer({
  port = Number(process.env.PORT ?? 4000),
  host = process.env.HOST ?? '0.0.0.0',
  dataFile = process.env.TROVE_DATA_FILE ?? DEFAULT_DATA_FILE,
  fetchImpl = globalThis.fetch,
  retryIntervalMs = 60_000
} = {}) {
  const store = await new BookmarkStore(dataFile).load();

  async function retryPending(id) {
    const bookmark = store.get(id);
    if (!bookmark || bookmark.archive?.status !== 'pending') return bookmark;
    try {
      const captured = await fetchPage(bookmark.url, fetchImpl);
      return store.replace(id, applyCapturedPage(bookmark, captured));
    } catch {
      return bookmark;
    }
  }

  async function refreshAvailability(id) {
    const bookmark = store.get(id);
    if (!bookmark) return null;
    const originalAvailable = await checkReachable(bookmark.url, fetchImpl);
    if (bookmark.originalAvailable === originalAvailable) return bookmark;
    const updated = { ...bookmark, originalAvailable, updatedAt: new Date().toISOString() };
    await store.replace(id, updated);
    return updated;
  }

  async function handleApi(request, response, url) {
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/health') return json(response, 200, { ok: true });

    if (request.method === 'GET' && path === '/api/bookmarks') {
      const search = url.searchParams.get('search') ?? '';
      const tag = url.searchParams.get('tag');
      const readLater = url.searchParams.get('readLater');
      const result = store.list().filter(item => {
        if (!matchesSearch(item, search)) return false;
        if (tag && !(item.tags ?? []).some(value => value.toLocaleLowerCase() === tag.toLocaleLowerCase())) return false;
        if (readLater === 'true' && !item.readLater) return false;
        return true;
      });
      return json(response, 200, { bookmarks: result.map(publicBookmark), total: result.length, tags: allKnownTags(store.list()) });
    }

    if (request.method === 'POST' && path === '/api/preview') {
      const body = await readJson(request);
      const parsed = parseWebUrl(body.url);
      const address = parsed.toString();
      const existing = findByCanonical(store.list(), address);
      if (existing) return json(response, 200, { kind: 'duplicate', bookmark: publicBookmark(existing) });
      try {
        const captured = await fetchPage(address, fetchImpl);
        return json(response, 200, { kind: 'preview', preview: { url: address, ...captured } });
      } catch {
        return json(response, 200, { kind: 'unreachable', url: address, source: sourceFromUrl(address) });
      }
    }

    if (request.method === 'POST' && path === '/api/bookmarks') {
      const body = await readJson(request);
      const existing = findByCanonical(store.list(), body.url);
      if (existing) return json(response, 409, { error: 'This page is already in your library.', bookmark: publicBookmark(existing) });
      const bookmark = createBookmark(body, allKnownTags(store.list()));
      await store.insert(bookmark);
      return json(response, 201, { bookmark: publicBookmark(bookmark) });
    }

    const match = path.match(/^\/api\/bookmarks\/([^/]+)(?:\/(read-later|retry|resolve|availability|archive))?$/);
    if (!match) return false;
    const id = decodeURIComponent(match[1]);
    const action = match[2];
    const bookmark = store.get(id);
    if (!bookmark) return json(response, 404, { error: 'Bookmark not found.' });

    if (request.method === 'GET' && action === 'archive') {
      if (bookmark.archive?.status !== 'ready') return json(response, 404, { error: 'Readable copy is not ready.' });
      return json(response, 200, {
        bookmark: publicBookmark(bookmark),
        archive: { capturedAt: bookmark.archive.capturedAt, body: bookmark.archive.body }
      });
    }

    if (request.method === 'PUT' && !action) {
      const changes = await readJson(request);
      const updated = updateBookmark(bookmark, changes, allKnownTags(store.list()));
      await store.replace(id, updated);
      return json(response, 200, { bookmark: publicBookmark(updated) });
    }

    if (request.method === 'DELETE' && !action) {
      await store.remove(id);
      return json(response, 200, { deleted: true, bookmark: publicBookmark(bookmark) });
    }

    if (request.method === 'POST' && action === 'read-later') {
      const updated = { ...bookmark, readLater: !bookmark.readLater, updatedAt: new Date().toISOString() };
      await store.replace(id, updated);
      return json(response, 200, { bookmark: publicBookmark(updated) });
    }

    if (request.method === 'POST' && action === 'retry') {
      const updated = await retryPending(id);
      return json(response, 200, { bookmark: publicBookmark(updated) });
    }

    if (request.method === 'POST' && action === 'availability') {
      const updated = await refreshAvailability(id);
      return json(response, 200, { bookmark: publicBookmark(updated) });
    }

    if (request.method === 'POST' && action === 'resolve') {
      const updated = await refreshAvailability(id);
      if (updated.originalAvailable) return json(response, 200, { target: 'original', url: updated.url });
      if (updated.archive?.status === 'ready') return json(response, 200, { target: 'archive', url: `/archive.html?id=${encodeURIComponent(id)}` });
      return json(response, 503, { error: 'The original page is unavailable and no readable copy is ready.' });
    }
    return false;
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const handled = await handleApi(request, response, url);
        if (handled !== false) return;
        return json(response, 404, { error: 'Not found.' });
      }
      if (await serveStatic(url.pathname, response)) return;
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    } catch (error) {
      const status = Number(error.status) || (error.message?.startsWith('Paste a complete') ? 400 : 500);
      if (status >= 500) console.error(error);
      if (!response.headersSent) json(response, status, { error: status >= 500 ? 'Something went wrong.' : error.message });
      else response.end();
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolveListen);
  });

  let retryTimer = null;
  if (retryIntervalMs > 0) {
    retryTimer = setInterval(async () => {
      for (const item of store.list().filter(entry => entry.archive?.status === 'pending')) await retryPending(item.id);
    }, retryIntervalMs);
    retryTimer.unref();
  }

  const address = server.address();
  const publicHost = typeof address === 'object' && address ? address.address : host;
  const publicPort = typeof address === 'object' && address ? address.port : port;
  const baseUrl = `http://${publicHost === '::' || publicHost === '0.0.0.0' ? '127.0.0.1' : publicHost}:${publicPort}`;
  return {
    server,
    store,
    baseUrl,
    close: () => new Promise(resolveClose => {
      if (retryTimer) clearInterval(retryTimer);
      server.close(resolveClose);
    })
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const app = await startServer();
  console.log(`Trove listening on ${app.baseUrl}`);
}
