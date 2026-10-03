import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addTag, createBookmark, findDuplicate, parseWebUrl, tagCounts } from './src/domain.js';
import { fetchPageMetadata } from './src/metadata.js';
import { BookmarkStore } from './src/store.js';

const moduleDirectory = fileURLToPath(new URL('.', import.meta.url));
const publicDirectory = resolve(moduleDirectory, 'public');
const defaultDataFile = resolve(moduleDirectory, 'data/bookmarks.json');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try { return body ? JSON.parse(body) : {}; }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function matchBookmarkPath(pathname, suffix = '') {
  const pattern = suffix
    ? new RegExp(`^/api/bookmarks/([^/]+)/${suffix}$`)
    : /^\/api\/bookmarks\/([^/]+)$/;
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = resolve(join(publicDirectory, safePath));
  if (!filePath.startsWith(publicDirectory)) return false;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
    const contents = await readFile(filePath);
    response.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
      'cache-control': filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
      'content-security-policy': "default-src 'self'; img-src 'self' https: http: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    });
    response.end(contents);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function createAppServer(options = {}) {
  const store = new BookmarkStore(options.dataFile || process.env.NOOK_DATA_FILE || defaultDataFile);
  await store.load();
  const allowPrivateFetch = options.allowPrivateFetch ?? process.env.NOOK_ALLOW_PRIVATE_FETCH === '1';
  const metadataFetcher = options.metadataFetcher || ((url) => fetchPageMetadata(url, { allowPrivate: allowPrivateFetch }));

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://localhost');
      const { pathname } = requestUrl;

      if (request.method === 'GET' && pathname === '/api/health') {
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === 'GET' && pathname === '/api/bookmarks') {
        return sendJson(response, 200, { bookmarks: store.list(), tags: tagCounts(store.list()) });
      }

      if (request.method === 'POST' && pathname === '/api/bookmarks') {
        const body = await readJson(request);
        if (!parseWebUrl(body.url)) {
          return sendJson(response, 400, {
            code: 'invalid_url',
            message: 'Enter a complete web address, such as https://example.com/article.'
          });
        }
        const duplicate = findDuplicate(store.list(), body.url);
        if (duplicate) {
          return sendJson(response, 409, {
            code: 'duplicate', message: 'This link is already saved.', bookmarkId: duplicate.id, bookmark: duplicate
          });
        }

        let metadata = null;
        let basicReason = '';
        try { metadata = await metadataFetcher(body.url); }
        catch (error) { basicReason = error.message || 'Page details were unavailable.'; }
        const bookmark = createBookmark(body.url, metadata);
        bookmark.basicReason = bookmark.isBasic ? basicReason : '';
        store.bookmarks.unshift(bookmark);
        await store.save();
        return sendJson(response, 201, {
          bookmark,
          metadataStatus: bookmark.isBasic ? 'basic' : 'captured'
        });
      }

      const refreshId = matchBookmarkPath(pathname, 'refresh');
      if (request.method === 'POST' && refreshId) {
        const bookmark = store.list().find(item => item.id === refreshId);
        if (!bookmark) return sendJson(response, 404, { message: 'Bookmark not found.' });
        if (bookmark.isBasic && bookmark.manualTitle) {
          const body = await readJson(request);
          if (body.confirmOverwrite !== true) {
            return sendJson(response, 409, {
              code: 'manual_title', message: 'Confirm before replacing the title you entered.'
            });
          }
        }
        try {
          const metadata = await metadataFetcher(bookmark.url);
          bookmark.title = metadata.title;
          bookmark.description = metadata.description || 'No description was provided by this page.';
          bookmark.image = metadata.image || '';
          bookmark.readingMinutes = metadata.readingMinutes || 1;
          bookmark.isBasic = false;
          bookmark.manualTitle = false;
          bookmark.basicReason = '';
          bookmark.capturedAt = new Date().toISOString();
          bookmark.updatedAt = bookmark.capturedAt;
          await store.save();
          return sendJson(response, 200, { bookmark });
        } catch (error) {
          return sendJson(response, 502, {
            code: 'refresh_failed', message: 'The page could not be reached. Your saved details were kept.'
          });
        }
      }

      const bookmarkId = matchBookmarkPath(pathname);
      if (request.method === 'PATCH' && bookmarkId) {
        const bookmark = store.list().find(item => item.id === bookmarkId);
        if (!bookmark) return sendJson(response, 404, { message: 'Bookmark not found.' });
        const body = await readJson(request);
        let tagResult = null;
        if (typeof body.note === 'string') bookmark.note = body.note.trim();
        if (typeof body.readLater === 'boolean') bookmark.readLater = body.readLater;
        if (typeof body.archived === 'boolean') bookmark.archived = body.archived;
        if (typeof body.title === 'string' && bookmark.isBasic && body.title.trim()) {
          bookmark.title = body.title.trim().slice(0, 500);
          bookmark.manualTitle = true;
        }
        if (typeof body.addTag === 'string') tagResult = addTag(store.list(), bookmark.id, body.addTag);
        bookmark.updatedAt = new Date().toISOString();
        await store.save();
        return sendJson(response, 200, {
          bookmark,
          tag: tagResult ? { name: tagResult.tag, added: tagResult.added, reused: tagResult.reused } : undefined,
          tags: tagCounts(store.list())
        });
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        if (await serveStatic(pathname, response)) return;
      }
      sendJson(response, 404, { message: 'Not found.' });
    } catch (error) {
      console.error(error);
      sendJson(response, error.status || 500, { message: error.status ? error.message : 'Something went wrong.' });
    }
  });
  return { server, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  const { server } = await createAppServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`Lattice is listening on http://0.0.0.0:${port}`);
  });
}
