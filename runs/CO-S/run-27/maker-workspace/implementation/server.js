import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkStore } from './lib/store.js';
import { fetchMetadata } from './lib/metadata.js';
import { canonicalAddress } from './lib/url.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 4000);
const dataFile = process.env.BOOKMARK_DATA_FILE || path.join(root, 'data', 'bookmarks.json');
const store = new BookmarkStore(dataFile);
await store.init();

function json(response, status, body) { response.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }); response.end(JSON.stringify(body)); }
async function body(request) { let text=''; for await (const chunk of request) { text += chunk; if (text.length > 1_000_000) throw new Error('Request is too large.'); } return text ? JSON.parse(text) : {}; }
function errorStatus(error) { if (error.code === 'NOT_FOUND') return 404; if (error.code === 'DUPLICATE') return 409; return 400; }

async function api(request, response, url) {
  try {
    if (request.method === 'GET' && url.pathname === '/api/bookmarks') return json(response, 200, await store.list({ query:url.searchParams.get('query') || '', tag:url.searchParams.get('tag') || '', readLater:url.searchParams.get('readLater') === 'true' }));
    if (request.method === 'GET' && url.pathname === '/api/tags') return json(response, 200, await store.tags());
    if (request.method === 'POST' && url.pathname === '/api/metadata') {
      const input=await body(request); const address=canonicalAddress(input.url); const duplicate=await store.findByUrl(address);
      if (duplicate) return json(response, 200, { duplicate:true, bookmark:duplicate });
      return json(response, 200, { duplicate:false, url:address, ...(await fetchMetadata(address)) });
    }
    if (request.method === 'POST' && url.pathname === '/api/bookmarks') return json(response, 201, await store.create(await body(request)));
    const match=url.pathname.match(/^\/api\/bookmarks\/([^/]+)(?:\/(read-later))?$/);
    if (match && request.method === 'PUT' && !match[2]) return json(response, 200, await store.update(match[1], await body(request)));
    if (match && request.method === 'PATCH' && match[2] === 'read-later') return json(response, 200, await store.toggleReadLater(match[1]));
    if (match && request.method === 'DELETE' && !match[2]) { await store.remove(match[1]); return json(response, 200, { deleted:true }); }
    return json(response, 404, { error:'Not found.' });
  } catch (error) { return json(response, errorStatus(error), { error:error.message, code:error.code || 'INVALID' }); }
}

const types={ '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const server=http.createServer(async (request,response) => {
  const url=new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return api(request,response,url);
  const relative=url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file=path.resolve(publicDir, relative);
  if (!file.startsWith(publicDir + path.sep) && file !== path.join(publicDir,'index.html')) { response.writeHead(403); return response.end(); }
  try { const content=await fs.readFile(file); response.writeHead(200,{ 'content-type':types[path.extname(file)] || 'application/octet-stream' }); response.end(content); }
  catch { try { const content=await fs.readFile(path.join(publicDir,'index.html')); response.writeHead(200,{ 'content-type':types['.html'] }); response.end(content); } catch { response.writeHead(404); response.end(); } }
});
server.listen(port,'0.0.0.0',()=>console.log(`Bookmark app listening on http://0.0.0.0:${port}`));
export { server, store };
