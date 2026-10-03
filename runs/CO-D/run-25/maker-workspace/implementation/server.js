import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './lib/store.js';
import { fetchPageDetails, newBookmark, normalizeLabel, normalizeUrl, parseWebUrl } from './lib/core.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataFile = process.env.KEEPMARK_DATA || path.join(root, 'data', 'keepmark.json');
const port = Number(process.env.PORT || 4000);
const store = new Store(dataFile);
await store.load();

const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
const body = async req => { let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 1_000_000) throw new Error('Request is too large'); } return value ? JSON.parse(value) : {}; };
const safePublicPath = pathname => { const resolved = path.resolve(publicDir, `.${pathname === '/' ? '/index.html' : pathname}`); return resolved.startsWith(publicDir) ? resolved : null; };
const mime = file => ({ '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' })[path.extname(file)] || 'application/octet-stream';

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, store.data);
  if (req.method === 'POST' && url.pathname === '/api/bookmarks') {
    const input = await body(req); let normalized;
    try { normalized = normalizeUrl(input.url); } catch (error) { return json(res, 400, { error: error.message }); }
    const duplicate = store.data.bookmarks.find(item => item.normalizedUrl === normalized);
    if (duplicate) return json(res, 409, { error: 'This bookmark is already saved', existingId: duplicate.id });
    const details = await fetchPageDetails(input.url); const bookmark = newBookmark(input.url, details);
    await store.mutate(data => data.bookmarks.push(bookmark)); return json(res, 201, bookmark);
  }
  const match = /^\/api\/bookmarks\/([^/]+)$/.exec(url.pathname);
  if (match && req.method === 'PATCH') {
    const input = await body(req); const item = store.data.bookmarks.find(entry => entry.id === match[1]);
    if (!item) return json(res, 404, { error: 'Bookmark not found' });
    if (input.url && input.url !== item.url) {
      try { parseWebUrl(input.url); } catch (error) { return json(res, 400, { error: error.message }); }
      const normalized = normalizeUrl(input.url); const duplicate = store.data.bookmarks.find(entry => entry.id !== item.id && entry.normalizedUrl === normalized);
      if (duplicate) return json(res, 409, { error: 'This bookmark is already saved', existingId: duplicate.id });
      const details = await fetchPageDetails(input.url); item.url = parseWebUrl(input.url).toString(); item.normalizedUrl = normalized; item.icon = details.icon; item.image = details.image; item.limited = details.limited;
      if (input.refreshDetails) { item.title = details.title; item.description = details.description; item.titleEdited = false; item.descriptionEdited = false; }
    }
    if (typeof input.title === 'string') { item.title = input.title.trim() || new URL(item.url).hostname; item.titleEdited = true; }
    if (typeof input.description === 'string') { item.description = input.description.trim(); item.descriptionEdited = true; }
    if (typeof input.note === 'string') item.note = input.note;
    if (Array.isArray(input.labels)) {
      const established = [...new Set(store.data.bookmarks.flatMap(entry => entry.labels))]; const labels = [];
      for (const value of input.labels) { const label = normalizeLabel(value, established); if (label && !labels.some(existing => existing.toLowerCase() === label.toLowerCase())) labels.push(label); }
      item.labels = labels;
    }
    if (typeof input.readLater === 'boolean') item.readLater = input.readLater;
    item.updatedAt = new Date().toISOString(); await store.save(); return json(res, 200, item);
  }
  if (match && req.method === 'DELETE') {
    const index = store.data.bookmarks.findIndex(entry => entry.id === match[1]); if (index < 0) return json(res, 404, { error: 'Bookmark not found' });
    await store.mutate(data => data.bookmarks.splice(index, 1)); res.writeHead(204); return res.end();
  }
  if (req.method === 'PUT' && url.pathname === '/api/preferences') {
    const input = await body(req); if (!['recent','oldest','az','za'].includes(input.sort)) return json(res, 400, { error: 'Unknown sort order' });
    await store.mutate(data => { data.preferences.sort = input.sort; }); return json(res, 200, store.data.preferences);
  }
  return json(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const file = safePublicPath(url.pathname); if (!file) { res.writeHead(404); return res.end('Not found'); }
    try { const content = await fs.readFile(file); res.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-cache' }); res.end(content); }
    catch { res.writeHead(404); res.end('Not found'); }
  } catch (error) { json(res, 500, { error: error.message || 'Unexpected error' }); }
});

server.listen(port, '0.0.0.0', () => console.log(`Keepmark listening on http://0.0.0.0:${port}`));

export { server };
