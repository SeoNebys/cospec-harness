import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import {
  canonicalAddress,
  canonicalizeTags,
  displayDomain,
  extractPageDetails,
  isPrivateHost,
  parseWebAddress,
  tagSummary
} from './lib/core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(here, 'public');
const dataFile = process.env.KEEPWELL_DATA_FILE || path.join(here, 'data', 'bookmarks.json');
const port = Number(process.env.PORT || 4000);
const allowPrivate = process.env.KEEPWELL_ALLOW_PRIVATE === '1';
let writeChain = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try { await fs.access(dataFile); }
  catch { await fs.writeFile(dataFile, JSON.stringify({ bookmarks: [] }, null, 2)); }
}

async function readStore() {
  await ensureStore();
  const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  return { bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [] };
}

async function updateStore(mutator) {
  let result;
  writeChain = writeChain.then(async () => {
    const store = await readStore();
    result = await mutator(store);
    const temporary = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(store, null, 2));
    await fs.rename(temporary, dataFile);
  });
  await writeChain;
  return result;
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  response.end(body);
}

async function bodyJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request body is too large.');
  }
  try { return body ? JSON.parse(body) : {}; }
  catch { throw new Error('Request body is not valid JSON.'); }
}

async function assertPublicDestination(url) {
  if (allowPrivate) return;
  if (isPrivateHost(url.hostname)) throw new Error('Private network addresses cannot be fetched.');
  const records = await lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => isPrivateHost(record.address))) throw new Error('Private network addresses cannot be fetched.');
}

async function fetchPageDetails(address) {
  const url = parseWebAddress(address);
  if (!url) throw new Error('Invalid address.');
  await assertPublicDestination(url);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
    headers: { 'user-agent': 'KeepwellBookmarkApp/1.0', accept: 'text/html,application/xhtml+xml' }
  });
  if (!response.ok) throw new Error(`Page returned ${response.status}.`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('Page is not HTML.');
  const html = (await response.text()).slice(0, 1_500_000);
  const details = extractPageDetails(html, url.toString());
  if (!details.title) throw new Error('Page did not provide a title.');
  return details;
}

function publicState(store) {
  const bookmarks = [...store.bookmarks].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { bookmarks, tags: tagSummary(bookmarks) };
}

async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(response, 200, publicState(await readStore()));
  }

  if (request.method === 'POST' && url.pathname === '/api/bookmarks') {
    const input = await bodyJson(request);
    const parsed = parseWebAddress(input.url);
    if (!parsed) return sendJson(response, 400, { code: 'invalid_address', message: 'That does not look like a complete page address. Try one that starts with http:// or https://.' });
    const address = canonicalAddress(parsed.toString());
    const store = await readStore();
    const duplicate = store.bookmarks.find(item => canonicalAddress(item.url) === address);
    if (duplicate) return sendJson(response, 409, { code: 'duplicate', message: 'You already saved this page.', bookmark: duplicate });

    let details;
    if (input.manual === true) {
      const title = String(input.title ?? '').trim();
      if (!title) return sendJson(response, 400, { code: 'title_required', message: 'Add a title so you can recognize this bookmark later.' });
      details = { title, description: String(input.description ?? '').trim(), domain: displayDomain(address) };
    } else {
      try { details = await fetchPageDetails(address); }
      catch { return sendJson(response, 422, { code: 'metadata_unavailable', message: 'We could not get details from this page. You can still save it by adding your own title.', url: address, domain: displayDomain(address) }); }
    }

    const now = new Date().toISOString();
    const bookmark = { id: randomUUID(), url: address, domain: details.domain, title: details.title, description: details.description, note: '', tags: [], readLater: false, createdAt: now, updatedAt: now };
    await updateStore(current => { current.bookmarks.push(bookmark); return bookmark; });
    return sendJson(response, 201, { bookmark });
  }

  const match = url.pathname.match(/^\/api\/bookmarks\/([^/]+)$/);
  if (request.method === 'PATCH' && match) {
    const changes = await bodyJson(request);
    let missing = false;
    let validation = null;
    const bookmark = await updateStore(store => {
      const item = store.bookmarks.find(candidate => candidate.id === decodeURIComponent(match[1]));
      if (!item) { missing = true; return null; }
      if (Object.hasOwn(changes, 'title')) {
        const title = String(changes.title ?? '').trim();
        if (!title) { validation = { code: 'title_required', message: 'Add a title so you can recognize this bookmark later.' }; return item; }
        item.title = title;
      }
      if (Object.hasOwn(changes, 'description')) item.description = String(changes.description ?? '').trim();
      if (Object.hasOwn(changes, 'note')) item.note = String(changes.note ?? '').trim();
      if (Object.hasOwn(changes, 'readLater')) item.readLater = changes.readLater === true;
      if (Object.hasOwn(changes, 'tags')) item.tags = canonicalizeTags(changes.tags, tagSummary(store.bookmarks).map(tag => tag.name));
      item.updatedAt = new Date().toISOString();
      return item;
    });
    if (missing) return sendJson(response, 404, { message: 'Bookmark not found.' });
    if (validation) return sendJson(response, 400, validation);
    return sendJson(response, 200, { bookmark });
  }

  return sendJson(response, 404, { message: 'Not found.' });
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

async function staticFile(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const resolved = path.resolve(publicRoot, relative);
  if (!resolved.startsWith(`${publicRoot}${path.sep}`) && resolved !== publicRoot) return false;
  try {
    const data = await fs.readFile(resolved);
    response.writeHead(200, { 'content-type': mimeTypes[path.extname(resolved)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(data);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(request, response, url);
    if (request.method === 'GET' && await staticFile(response, url.pathname)) return;
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { message: 'Something went wrong. Please try again.' });
    else response.end();
  }
});

await ensureStore();
server.listen(port, '0.0.0.0', () => console.log(`Keepwell listening on 0.0.0.0:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
