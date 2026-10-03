const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { BookmarkStore } = require('./store');
const { fetchPageMetadata, normalizeUrl } = require('./metadata');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_DATA_FILE = path.join(__dirname, 'data', 'bookmarks.json');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml'
};

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request is too large.');
  }
  if (!body) return {};
  return JSON.parse(body);
}

function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return [...new Set(values.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
}

function createRequestHandler({ dataFile = DEFAULT_DATA_FILE, metadataProvider = fetchPageMetadata } = {}) {
  const store = new BookmarkStore(dataFile);

  return async function handle(request, response) {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (url.pathname === '/api/bookmarks' && request.method === 'GET') {
        return json(response, 200, { bookmarks: await store.list() });
      }

      if (url.pathname === '/api/bookmarks' && request.method === 'POST') {
        const body = await readJson(request);
        let normalizedUrl;
        try {
          normalizedUrl = normalizeUrl(body.url);
        } catch (error) {
          return json(response, 400, { code: 'INVALID_URL', message: error.message });
        }
        const existing = await store.findByUrl(normalizedUrl);
        if (existing) {
          return json(response, 409, { code: 'DUPLICATE_URL', message: `Already saved: ${existing.title}`, bookmark: existing });
        }
        const metadata = await metadataProvider(normalizedUrl);
        const now = new Date().toISOString();
        const bookmark = await store.create({
          id: randomUUID(), url: normalizedUrl,
          title: metadata.title || new URL(normalizedUrl).hostname,
          siteName: metadata.siteName || new URL(normalizedUrl).hostname,
          summary: metadata.summary || '', note: '', tags: [],
          unread: true, archived: false, createdAt: now, updatedAt: now
        });
        return json(response, 201, { bookmark, warning: metadata.warning || null });
      }

      const tagMatch = url.pathname.match(/^\/api\/bookmarks\/([^/]+)\/tags(?:\/(.+))?$/);
      if (tagMatch && request.method === 'POST' && !tagMatch[2]) {
        const bookmarkId = decodeURIComponent(tagMatch[1]);
        const body = await readJson(request);
        const bookmarks = await store.list();
        const current = bookmarks.find((item) => item.id === bookmarkId);
        if (!current) return json(response, 404, { message: 'Bookmark not found.' });
        const tags = normalizeTags([...(current.tags || []), ...normalizeTags(body.tags)]);
        return json(response, 200, { bookmark: await store.update(bookmarkId, { tags }) });
      }
      if (tagMatch && request.method === 'DELETE' && tagMatch[2]) {
        const bookmarkId = decodeURIComponent(tagMatch[1]);
        const tag = decodeURIComponent(tagMatch[2]).toLowerCase();
        const bookmarks = await store.list();
        const current = bookmarks.find((item) => item.id === bookmarkId);
        if (!current) return json(response, 404, { message: 'Bookmark not found.' });
        const tags = (current.tags || []).filter((item) => item !== tag);
        return json(response, 200, { bookmark: await store.update(bookmarkId, { tags }) });
      }

      const bookmarkMatch = url.pathname.match(/^\/api\/bookmarks\/([^/]+)$/);
      if (bookmarkMatch && request.method === 'PATCH') {
        const bookmarkId = decodeURIComponent(bookmarkMatch[1]);
        const body = await readJson(request);
        const changes = {};
        for (const key of ['title', 'summary', 'note', 'unread', 'archived']) {
          if (Object.hasOwn(body, key)) changes[key] = body[key];
        }
        if (Object.hasOwn(changes, 'title')) {
          changes.title = String(changes.title).trim();
          if (!changes.title) return json(response, 400, { code: 'TITLE_REQUIRED', message: 'Add a title so you can recognize this bookmark later.' });
        }
        if (Object.hasOwn(changes, 'summary')) changes.summary = String(changes.summary).trim();
        if (Object.hasOwn(changes, 'note')) changes.note = String(changes.note).trim();
        if (Object.hasOwn(changes, 'unread')) changes.unread = Boolean(changes.unread);
        if (Object.hasOwn(changes, 'archived')) changes.archived = Boolean(changes.archived);
        const bookmark = await store.update(bookmarkId, changes);
        return bookmark ? json(response, 200, { bookmark }) : json(response, 404, { message: 'Bookmark not found.' });
      }
      if (bookmarkMatch && request.method === 'DELETE') {
        const removed = await store.delete(decodeURIComponent(bookmarkMatch[1]));
        return removed ? json(response, 200, { bookmark: removed }) : json(response, 404, { message: 'Bookmark not found.' });
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return json(response, 404, { message: 'Not found.' });
      }

      const requestedPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const resolvedPath = path.resolve(PUBLIC_DIR, requestedPath);
      if (!resolvedPath.startsWith(`${PUBLIC_DIR}${path.sep}`) && resolvedPath !== path.join(PUBLIC_DIR, 'index.html')) {
        response.writeHead(404); return response.end('Not found');
      }
      try {
        const file = await fs.readFile(resolvedPath);
        response.writeHead(200, { 'content-type': MIME_TYPES[path.extname(resolvedPath)] || 'application/octet-stream' });
        return response.end(request.method === 'HEAD' ? undefined : file);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        response.writeHead(404); return response.end('Not found');
      }
    } catch (error) {
      if (error instanceof SyntaxError) return json(response, 400, { message: 'Invalid request.' });
      console.error(error);
      return json(response, 500, { message: 'Something went wrong.' });
    }
  };
}

function createServer(options) {
  return http.createServer(createRequestHandler(options));
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  const server = createServer({ dataFile: process.env.BOOKMARK_DATA_FILE || DEFAULT_DATA_FILE });
  server.listen(port, '0.0.0.0', () => console.log(`Keep is listening on http://0.0.0.0:${port}`));
}

module.exports = { createRequestHandler, createServer, normalizeTags };
