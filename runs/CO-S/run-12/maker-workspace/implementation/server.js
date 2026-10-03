import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkStore } from './lib/store.js';
import { fetchMetadata } from './lib/metadata.js';
import { normalizeUrl } from './lib/bookmarks.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(root, 'public');
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const dataFile = process.env.KEEPWELL_DATA || join(root, 'data', 'bookmarks.json');
const store = new BookmarkStore(dataFile);
await store.load();

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; img-src 'self' https: http: data:; style-src 'self'; script-src 'self'; connect-src 'self'" });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
async function jsonBody(req) {
  const parts = []; let total = 0;
  for await (const part of req) { total += part.length; if (total > 1_000_000) throw new Error('Request is too large.'); parts.push(part); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8') || '{}'); } catch { throw new Error('Invalid request.'); }
}
async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/bookmarks') return send(res, 200, { bookmarks: store.list() });
  if (req.method === 'POST' && url.pathname === '/api/metadata') {
    const body = await jsonBody(req); const normalized = normalizeUrl(body.url); const existing = store.findByUrl(normalized);
    if (existing) return send(res, 200, { duplicate: true, bookmark: existing });
    try { return send(res, 200, { duplicate: false, metadata: await fetchMetadata(normalized) }); }
    catch (error) { return send(res, 422, { error: error.message, url: normalized, canEnterManually: true }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/bookmarks') {
    const result = await store.create(await jsonBody(req)); return send(res, result.duplicate ? 200 : 201, result);
  }
  const match = url.pathname.match(/^\/api\/bookmarks\/([a-f0-9-]+)$/i);
  if (req.method === 'PATCH' && match) {
    const bookmark = await store.update(match[1], await jsonBody(req));
    return bookmark ? send(res, 200, { bookmark }) : send(res, 404, { error: 'Bookmark not found.' });
  }
  return send(res, 404, { error: 'Not found.' });
}
async function staticFile(res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = join(publicRoot, safe);
  if (!file.startsWith(publicRoot)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  try { return send(res, 200, await readFile(file), mime[extname(file)] || 'application/octet-stream'); }
  catch { if (!extname(pathname)) return send(res, 200, await readFile(join(publicRoot, 'index.html')), mime['.html']); return send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try { if (url.pathname.startsWith('/api/')) await api(req, res, url); else await staticFile(res, url.pathname); }
  catch (error) { send(res, error.message?.includes('web address') || error.message?.includes('title') ? 400 : 500, { error: error.message || 'Unexpected error.' }); }
});
server.listen(port, host, () => console.log(`Keepwell listening on http://${host}:${port}`));

export { server };
