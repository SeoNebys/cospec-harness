import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Store } from './lib/store.js';
import { applyBulk, cleanLabels, makeBookmark, normalizeUrl, parseHttpUrl, sourceFor } from './lib/domain.js';
import { captureUrl, failedCapture } from './lib/capture.js';
import { browserHtml, parseBrowserBookmarks, previewImport } from './lib/import.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const store = new Store(process.env.KEPT_DATA_FILE || path.join(root, 'data', 'store.json'));
const previews = new Map();
await store.load();

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(body));
}

async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 100 * 1024 * 1024) throw Object.assign(new Error('Request is too large'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('The request could not be read'), { status: 400 }); }
}

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function findBookmark(state, id) {
  const bookmark = state.bookmarks.find(item => item.id === id);
  if (!bookmark) throw Object.assign(new Error('Bookmark not found'), { status: 404 });
  return bookmark;
}

async function routeApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, store.read());

  if (request.method === 'POST' && url.pathname === '/api/bookmarks') {
    const input = await body(request);
    let normalized;
    try { normalized = normalizeUrl(input.url); } catch (error) { return json(response, 400, { error: error.message }); }
    const existing = store.read().bookmarks.find(item => item.normalizedUrl === normalized);
    if (existing) return json(response, 200, { duplicate: true, bookmark: existing, message: 'Already saved' });
    let details;
    try { details = await captureUrl(input.url); }
    catch (error) { details = { title: new URL(input.url).hostname, description: '', favicon: '', capture: failedCapture(error) }; }
    const bookmark = makeBookmark({ url: input.url, title: details.title, description: details.description, favicon: details.favicon, labels: input.labels, readLater: input.readLater, capture: details.capture });
    await store.update(state => state.bookmarks.unshift(bookmark));
    return json(response, 201, { bookmark });
  }

  const match = url.pathname.match(/^\/api\/bookmarks\/([^/]+)(?:\/(retry))?$/);
  if (match && request.method === 'PATCH' && !match[2]) {
    const input = await body(request);
    let updated;
    try {
      await store.update(state => {
        const bookmark = findBookmark(state, match[1]);
        if (input.url !== undefined) {
          const parsed = parseHttpUrl(input.url);
          const normalized = normalizeUrl(input.url);
          const duplicate = state.bookmarks.find(item => item.id !== bookmark.id && item.normalizedUrl === normalized);
          if (duplicate) throw Object.assign(new Error('That address is already saved'), { status: 409, duplicateId: duplicate.id });
          bookmark.url = parsed.toString(); bookmark.normalizedUrl = normalized; bookmark.source = sourceFor(input.url);
        }
        if (input.title !== undefined) bookmark.title = String(input.title).trim() || bookmark.source;
        if (input.description !== undefined) bookmark.description = String(input.description).trim();
        if (input.labels !== undefined) bookmark.labels = cleanLabels(input.labels);
        if (input.readLater !== undefined) bookmark.readLater = Boolean(input.readLater);
        if (input.putAway !== undefined) bookmark.putAway = Boolean(input.putAway);
        updated = structuredClone(bookmark);
      });
    } catch (error) { return json(response, error.status || 400, { error: error.message, duplicateId: error.duplicateId }); }
    return json(response, 200, { bookmark: updated });
  }
  if (match && request.method === 'DELETE' && !match[2]) {
    let removed;
    try { await store.update(state => { removed = findBookmark(state, match[1]); state.bookmarks = state.bookmarks.filter(item => item.id !== match[1]); }); }
    catch (error) { return json(response, error.status || 500, { error: error.message }); }
    return json(response, 200, { bookmark: removed });
  }
  if (match && request.method === 'POST' && match[2] === 'retry') {
    const current = store.read().bookmarks.find(item => item.id === match[1]);
    if (!current) return json(response, 404, { error: 'Bookmark not found' });
    let details;
    try { details = await captureUrl(current.url); }
    catch (error) { return json(response, 502, { error: `Still unable to gather details: ${error.message}. Your bookmark is safe.` }); }
    let updated;
    await store.update(state => {
      const bookmark = findBookmark(state, match[1]);
      bookmark.capture = details.capture; bookmark.detailsStatus = 'ready'; bookmark.favicon = details.favicon;
      if (!bookmark.title || bookmark.title === bookmark.source) bookmark.title = details.title;
      if (!bookmark.description) bookmark.description = details.description;
      updated = structuredClone(bookmark);
    });
    return json(response, 200, { bookmark: updated });
  }

  if (request.method === 'POST' && url.pathname === '/api/bulk') {
    const input = await body(request);
    if (!Array.isArray(input.ids) || !input.ids.length) return json(response, 400, { error: 'Select at least one bookmark' });
    await store.update(state => { state.bookmarks = applyBulk(state.bookmarks, input.ids, input.action, input.value); });
    return json(response, 200, { state: store.read() });
  }

  if (request.method === 'POST' && url.pathname === '/api/saved-searches') {
    const input = await body(request);
    const saved = { id: randomUUID(), name: String(input.name || '').trim(), filters: input.filters || {} };
    if (!saved.name) return json(response, 400, { error: 'Give this search a name' });
    await store.update(state => state.savedSearches.push(saved));
    return json(response, 201, { saved });
  }
  const searchMatch = url.pathname.match(/^\/api\/saved-searches\/([^/]+)$/);
  if (searchMatch && request.method === 'PATCH') {
    const input = await body(request); let saved;
    await store.update(state => { saved = state.savedSearches.find(item => item.id === searchMatch[1]); if (!saved) throw Object.assign(new Error('Saved search not found'), { status: 404 }); if (input.name) saved.name = String(input.name).trim(); if (input.filters) saved.filters = input.filters; });
    return json(response, 200, { saved });
  }
  if (searchMatch && request.method === 'DELETE') {
    await store.update(state => { state.savedSearches = state.savedSearches.filter(item => item.id !== searchMatch[1]); });
    return json(response, 200, { ok: true });
  }

  if (request.method === 'PATCH' && url.pathname === '/api/settings') {
    const input = await body(request);
    await store.update(state => {
      if ([25, 50, 100].includes(Number(input.pageSize))) state.settings.pageSize = Number(input.pageSize);
      if (['compact', 'comfortable', 'large'].includes(input.textSize)) state.settings.textSize = input.textSize;
      if (['newest', 'oldest', 'name'].includes(input.defaultSort)) state.settings.defaultSort = input.defaultSort;
    });
    return json(response, 200, { settings: store.read().settings });
  }

  if (request.method === 'POST' && url.pathname === '/api/import/preview') {
    const input = await body(request);
    try {
      let incoming;
      let kind = 'browser';
      if (/\.json$/i.test(input.name || '')) {
        const parsed = JSON.parse(input.content);
        if (parsed.format !== 'kept-full-backup' || !parsed.data?.bookmarks) throw new Error('That file is not a Kept full backup.');
        incoming = parsed.data.bookmarks; kind = 'backup';
      } else incoming = parseBrowserBookmarks(input.content || '');
      const summary = kind === 'backup'
        ? { total: incoming.length, newCount: incoming.filter(item => !store.read().bookmarks.some(saved => saved.normalizedUrl === item.normalizedUrl)).length, duplicates: incoming.filter(item => store.read().bookmarks.some(saved => saved.normalizedUrl === item.normalizedUrl)).length, dated: incoming.filter(item => item.dateKnown).length, folders: [...new Set(incoming.flatMap(item => item.labels || []))].sort() }
        : previewImport(incoming, store.read().bookmarks);
      const token = randomUUID(); previews.set(token, { incoming, kind, backupData: kind === 'backup' ? JSON.parse(input.content).data : null, expires: Date.now() + 10 * 60_000 });
      return json(response, 200, { token, kind, ...summary });
    } catch (error) { return json(response, 400, { error: `${error.message} Nothing in your library has changed.` }); }
  }

  if (request.method === 'POST' && url.pathname === '/api/import/commit') {
    const input = await body(request); const preview = previews.get(input.token);
    if (!preview || preview.expires < Date.now()) return json(response, 400, { error: 'That preview has expired. Choose the file again; nothing has changed.' });
    let added = 0; let merged = 0;
    await store.update(state => {
      for (const incoming of preview.incoming) {
        const normalized = incoming.normalizedUrl || normalizeUrl(incoming.url);
        const existing = state.bookmarks.find(item => item.normalizedUrl === normalized);
        if (existing) { existing.labels = cleanLabels([...(existing.labels || []), ...(incoming.labels || [])]); merged++; continue; }
        if (preview.kind === 'backup') state.bookmarks.push({ ...structuredClone(incoming), id: randomUUID(), normalizedUrl: normalized });
        else state.bookmarks.push(makeBookmark({ ...incoming, description: '', capture: { status: 'failed', type: 'page', savedAt: null, reason: 'Imported without a saved copy' } }));
        added++;
      }
      if (preview.kind === 'backup') {
        for (const saved of preview.backupData.savedSearches || []) {
          if (!state.savedSearches.some(item => item.name.toLocaleLowerCase() === String(saved.name).toLocaleLowerCase())) state.savedSearches.push({ ...structuredClone(saved), id: randomUUID() });
        }
        if (preview.backupData.settings) state.settings = { ...state.settings, ...preview.backupData.settings };
      }
    });
    previews.delete(input.token);
    return json(response, 200, { added, merged });
  }

  if (request.method === 'GET' && url.pathname === '/api/export/full') {
    try {
      const payload = JSON.stringify({ format: 'kept-full-backup', exportedAt: new Date().toISOString(), data: store.read() }, null, 2);
      response.writeHead(200, { 'content-type': 'application/json', 'content-disposition': `attachment; filename="kept-backup-${new Date().toISOString().slice(0, 10)}.json"` }); response.end(payload); return;
    } catch { return json(response, 500, { error: 'The full backup could not be created. Your library is untouched and safe. Please retry.' }); }
  }
  if (request.method === 'GET' && url.pathname === '/api/export/browser') {
    const payload = browserHtml(store.read().bookmarks);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-disposition': 'attachment; filename="kept-bookmarks.html"' }); response.end(payload); return;
  }
  return false;
}

async function serveCapture(response, url) {
  const match = url.pathname.match(/^\/saved\/(page|pdf)\/([^/]+)$/);
  if (!match) return false;
  const bookmark = store.read().bookmarks.find(item => item.id === match[2]);
  if (!bookmark || bookmark.capture?.status !== 'ready' || bookmark.capture.type !== match[1]) { response.writeHead(404); response.end('Saved copy not found'); return true; }
  if (match[1] === 'pdf') {
    response.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="${String(bookmark.capture.filename).replaceAll('"', '')}"`, 'content-security-policy': "default-src 'none'; frame-ancestors 'self'" });
    response.end(Buffer.from(bookmark.capture.data, 'base64')); return true;
  }
  const capture = bookmark.capture;
  const image = capture.image ? `<img src="${escapeHtml(capture.image)}" alt="Saved page image">` : '';
  const paragraphs = escapeHtml(capture.text).split(/\n{2,}/).filter(Boolean).map(text => `<p>${text}</p>`).join('');
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(capture.title)}</title><style>body{font:18px/1.7 Georgia,serif;max-width:760px;margin:48px auto;padding:0 24px;color:#20231f}small{font:14px system-ui;color:#647066}img{max-width:100%;border-radius:12px}h1{line-height:1.15}</style></head><body><small>Saved ${escapeHtml(new Date(capture.savedAt).toLocaleString())} from ${escapeHtml(capture.sourceUrl)}</small><h1>${escapeHtml(capture.title)}</h1>${image}${paragraphs}</body></html>`;
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; frame-ancestors 'self'" }); response.end(document); return true;
}

async function serveStatic(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(publicDir, requested);
  if (!file.startsWith(`${publicDir}${path.sep}`) && file !== path.join(publicDir, 'index.html')) return false;
  try {
    const data = await fs.readFile(file);
    const extension = path.extname(file);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'content-type': types[extension] || 'application/octet-stream' }); response.end(data); return true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) { const handled = await routeApi(request, response, url); if (handled !== false) return; }
    if (await serveCapture(response, url)) return;
    if (await serveStatic(response, url.pathname)) return;
    response.writeHead(404); response.end('Not found');
  } catch (error) { console.error(error); if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Your library is unchanged.' }); else response.end(); }
});

const port = Number(process.env.PORT || 4000);
server.listen(port, '0.0.0.0', () => console.log(`Kept is ready on http://0.0.0.0:${port}`));
