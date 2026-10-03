const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { BookmarkStore } = require('./store');
const { canonicalizeAddress, parseWebAddress } = require('./urls');
const { fetchPageMetadata } = require('./metadata');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  response.end(body);
}

function sendError(response, status, code, message, extra = {}) {
  sendJson(response, status, { error: { code, message, ...extra } });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('Request is too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON'), { status: 400 });
  }
}

function isDuplicateError(error) {
  return error && String(error.message).includes('UNIQUE constraint failed');
}

function searchable(bookmark, term) {
  const value = term.toLocaleLowerCase();
  return [bookmark.title, bookmark.description, bookmark.source]
    .some((field) => field.toLocaleLowerCase().includes(value));
}

function createBookmarkServer(options = {}) {
  const dbPath = options.dbPath || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bookmarks.db');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const store = new BookmarkStore(dbPath);

  const server = http.createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    response.setHeader('x-frame-options', 'DENY');

    const requestUrl = new URL(request.url, 'http://app.local');
    const pathname = requestUrl.pathname;

    try {
      if (request.method === 'GET' && STATIC_FILES.has(pathname)) {
        const [file, contentType] = STATIC_FILES.get(pathname);
        const body = fs.readFileSync(path.join(PUBLIC_DIR, file));
        response.writeHead(200, { 'content-type': contentType, 'content-length': body.length });
        response.end(body);
        return;
      }

      if (request.method === 'GET' && pathname === '/api/bookmarks') {
        const term = (requestUrl.searchParams.get('query') || '').trim();
        const tag = (requestUrl.searchParams.get('tag') || '').trim().toLocaleLowerCase();
        const view = requestUrl.searchParams.get('view') || 'all';
        let bookmarks = store.all();
        if (term) bookmarks = bookmarks.filter((bookmark) => searchable(bookmark, term));
        if (tag) bookmarks = bookmarks.filter((bookmark) => bookmark.tags.some((item) => item.toLocaleLowerCase() === tag));
        if (view === 'later') bookmarks = bookmarks.filter((bookmark) => bookmark.readLater);
        sendJson(response, 200, { bookmarks });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/bookmarks') {
        const body = await readJson(request);
        let parsed;
        let canonicalUrl;
        try {
          parsed = parseWebAddress(body.url);
          canonicalUrl = canonicalizeAddress(body.url);
        } catch (error) {
          sendError(response, 422, 'invalid_address', error.message);
          return;
        }

        const existing = store.findByCanonical(canonicalUrl);
        if (existing) {
          sendError(response, 409, 'duplicate', 'This page is already saved.', { bookmark: existing });
          return;
        }

        const source = parsed.hostname.replace(/^www\./i, '');
        let metadata;
        let metadataUnavailable = false;
        try {
          metadata = await fetchPageMetadata(parsed.toString(), fetchImpl);
          if (!metadata.title && !metadata.description) metadataUnavailable = true;
        } catch {
          metadata = { title: '', description: '', source };
          metadataUnavailable = true;
        }

        const title = (metadata.title || source).slice(0, 500);
        const description = (metadata.description || (metadataUnavailable
          ? 'Page details unavailable — edit this bookmark to add your own.'
          : '')).slice(0, 3000);

        try {
          const bookmark = store.create({
            url: parsed.toString(),
            canonicalUrl,
            title,
            description,
            source: metadata.source || source,
            tags: body.tags,
            readLater: Boolean(body.readLater)
          });
          sendJson(response, 201, { bookmark, metadataUnavailable });
        } catch (error) {
          if (isDuplicateError(error)) {
            const raced = store.findByCanonical(canonicalUrl);
            sendError(response, 409, 'duplicate', 'This page is already saved.', { bookmark: raced });
            return;
          }
          throw error;
        }
        return;
      }

      const itemMatch = pathname.match(/^\/api\/bookmarks\/(\d+)$/);
      if (itemMatch && request.method === 'PATCH') {
        const id = Number(itemMatch[1]);
        const current = store.get(id);
        if (!current) {
          sendError(response, 404, 'not_found', 'Bookmark not found.');
          return;
        }
        const body = await readJson(request);
        const url = body.url === undefined ? current.url : body.url;
        let parsed;
        let canonicalUrl;
        try {
          parsed = parseWebAddress(url);
          canonicalUrl = canonicalizeAddress(url);
        } catch (error) {
          sendError(response, 422, 'invalid_address', error.message);
          return;
        }

        const conflict = store.findByCanonical(canonicalUrl, id);
        if (conflict) {
          sendError(response, 409, 'duplicate', `That page is already saved as “${conflict.title}.”`, { bookmark: conflict });
          return;
        }

        const source = parsed.hostname.replace(/^www\./i, '');
        const title = String(body.title === undefined ? current.title : body.title).trim() || source;
        const updated = store.update(id, {
          url: parsed.toString(),
          canonicalUrl,
          title: title.slice(0, 500),
          description: String(body.description === undefined ? current.description : body.description).trim().slice(0, 3000),
          source,
          tags: body.tags === undefined ? current.tags : body.tags,
          readLater: body.readLater === undefined ? current.readLater : Boolean(body.readLater)
        });
        sendJson(response, 200, { bookmark: updated });
        return;
      }

      if (itemMatch && request.method === 'DELETE') {
        const deleted = store.delete(Number(itemMatch[1]));
        if (!deleted) {
          sendError(response, 404, 'not_found', 'Bookmark not found.');
          return;
        }
        response.writeHead(204);
        response.end();
        return;
      }

      sendError(response, 404, 'not_found', 'Not found.');
    } catch (error) {
      sendError(response, error.status || 500, 'server_error', error.status ? error.message : 'Something went wrong. Please try again.');
    }
  });

  server.on('close', () => store.close());
  return { server, store };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  const host = process.env.HOST || '0.0.0.0';
  const { server } = createBookmarkServer();
  server.listen(port, host, () => {
    console.log(`Trove is listening on http://${host}:${port}`);
  });
}

module.exports = { createBookmarkServer };
