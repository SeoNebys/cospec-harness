import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { BookmarkStore } from './store.js';
import { canonicalAddress, extractMetadata, normalizeTags, parseWebAddress, searchableText, sectionIncludes } from './lib.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(root, 'public');
const store = new BookmarkStore(process.env.KEEPMARK_DATA_FILE || join(root, 'data', 'bookmarks.json'));
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  if (Buffer.concat(chunks).length > 1_000_000) throw new Error('Request is too large');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function getMetadata(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal,
      headers: { 'user-agent': 'Keepmark/1.0 personal bookmark metadata fetcher', accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Unavailable');
    const html = await response.text();
    return extractMetadata(html.slice(0, 750_000), url);
  } catch {
    return { title: url, description: '', metadataStatus: 'unavailable' };
  } finally { clearTimeout(timeout); }
}

function findBookmark(data, id) { return data.bookmarks.find(item => item.id === id); }

async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/bookmarks') {
    const data = await store.read();
    const section = url.searchParams.get('section') || 'active';
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const tag = (url.searchParams.get('tag') || '').trim().toLowerCase();
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const all = data.bookmarks.filter(item => sectionIncludes(item, section))
      .filter(item => !search || searchableText(item).includes(search))
      .filter(item => !tag || item.tags.includes(tag))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(response, 200, { items: all.slice(offset, offset + limit), total: all.length, hasMore: offset + limit < all.length });
  }

  if (request.method === 'GET' && url.pathname === '/api/summary') {
    const data = await store.read();
    const count = section => data.bookmarks.filter(item => sectionIncludes(item, section)).length;
    return json(response, 200, { active: count('active'), readLater: count('read-later'), archive: count('archive') });
  }

  if (request.method === 'GET' && url.pathname === '/api/tags') {
    const data = await store.read();
    const section = url.searchParams.get('section') || 'active';
    const counts = {};
    for (const item of data.bookmarks.filter(bookmark => sectionIncludes(bookmark, section))) {
      for (const tag of item.tags) counts[tag] = (counts[tag] || 0) + 1;
    }
    return json(response, 200, Object.entries(counts).sort((a,b) => a[0].localeCompare(b[0])).map(([name,count]) => ({name,count})));
  }

  if (request.method === 'POST' && url.pathname === '/api/bookmarks') {
    const input = await body(request);
    const parsed = parseWebAddress(input.url);
    if (!parsed) return json(response, 422, { error: 'Enter a complete web address, such as https://example.com' });
    const address = parsed.toString();
    const canonical = canonicalAddress(address);
    const existingData = await store.read();
    const existing = existingData.bookmarks.find(item => item.canonicalUrl === canonical);
    if (existing) return json(response, 409, { error: 'Already saved', bookmark: existing });
    const metadata = await getMetadata(address);
    const now = new Date().toISOString();
    const bookmark = {
      id: randomUUID(), url: address, canonicalUrl: canonical,
      title: metadata.title, description: metadata.description,
      metadataStatus: metadata.metadataStatus,
      note: String(input.note || '').trim(), tags: normalizeTags(input.tags),
      readLater: Boolean(input.readLater), archivedAt: null,
      createdAt: now, updatedAt: now
    };
    const saved = await store.mutate(data => {
      const duplicate = data.bookmarks.find(item => item.canonicalUrl === canonical);
      if (duplicate) return { duplicate };
      data.bookmarks.push(bookmark); return { bookmark };
    });
    if (saved.duplicate) return json(response, 409, { error: 'Already saved', bookmark: saved.duplicate });
    return json(response, 201, { bookmark });
  }

  const match = url.pathname.match(/^\/api\/bookmarks\/([^/]+)(?:\/(archive|restore|complete-read-later))?$/);
  if (match && request.method === 'PATCH' && !match[2]) {
    const input = await body(request);
    const updated = await store.mutate(data => {
      const item = findBookmark(data, match[1]); if (!item) return null;
      if ('title' in input) item.title = String(input.title).trim() || item.url;
      if ('description' in input) item.description = String(input.description).trim();
      if ('note' in input) item.note = String(input.note).trim();
      if ('tags' in input) item.tags = normalizeTags(input.tags);
      if ('readLater' in input && !item.archivedAt) item.readLater = Boolean(input.readLater);
      item.updatedAt = new Date().toISOString(); return item;
    });
    return updated ? json(response, 200, { bookmark: updated }) : json(response, 404, { error: 'Bookmark not found' });
  }

  if (match && request.method === 'POST' && match[2]) {
    const updated = await store.mutate(data => {
      const item = findBookmark(data, match[1]); if (!item) return null;
      const now = new Date().toISOString();
      if (match[2] === 'archive') { item.archivedAt = now; item.readLater = false; }
      if (match[2] === 'restore') { item.archivedAt = null; item.readLater = false; }
      if (match[2] === 'complete-read-later') item.readLater = false;
      item.updatedAt = now; return item;
    });
    return updated ? json(response, 200, { bookmark: updated }) : json(response, 404, { error: 'Bookmark not found' });
  }

  if (match && request.method === 'DELETE' && !match[2]) {
    const deleted = await store.mutate(data => {
      const index = data.bookmarks.findIndex(item => item.id === match[1]);
      if (index < 0) return null;
      return data.bookmarks.splice(index, 1)[0];
    });
    return deleted ? json(response, 200, { deleted: true }) : json(response, 404, { error: 'Bookmark not found' });
  }
  return false;
}

async function handler(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const handled = await api(request, response, url);
      if (handled === false) json(response, 404, { error: 'Not found' });
      return;
    }
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const safe = normalize(requested).replace(/^(\.\.[/\\])+/, '');
    const file = join(publicRoot, safe);
    if (!file.startsWith(publicRoot)) return json(response, 404, { error: 'Not found' });
    const content = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return json(response, 404, { error: 'Not found' });
    if (error instanceof SyntaxError) return json(response, 400, { error: 'Invalid request' });
    console.error(error); json(response, 500, { error: 'Something went wrong' });
  }
}

export function createServer() { return http.createServer(handler); }
if (process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(port, host, () => console.log(`Keepmark listening on http://${host}:${port}`));
