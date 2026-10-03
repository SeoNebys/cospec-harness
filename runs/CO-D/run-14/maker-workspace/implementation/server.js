import http from 'node:http';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import {
  SearchSyntaxError, applyRecoveredDetails, demoPageFor, extractPage, makeBookmark, normalizeUrl,
  parseWebAddress, publicBookmark, searchBookmarks, uniqueTags
} from './src/core.js';
import { JsonStore } from './src/store.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const publicOrigin = process.env.PUBLIC_ORIGIN || `http://maker:${port}`;
const dataFile = process.env.KEEPWELL_DATA || join(root, 'data', 'keepwell.json');
const accountEmail = (process.env.KEEPWELL_EMAIL || 'alex@example.com').toLowerCase();
const accountPassword = process.env.KEEPWELL_PASSWORD || 'bookmarks';
const sessionSecret = process.env.KEEPWELL_SESSION_SECRET || randomBytes(32).toString('hex');
const passwordSalt = process.env.KEEPWELL_PASSWORD_SALT || 'keepwell-review-salt';
const passwordDigest = scryptSync(accountPassword, passwordSalt, 32);
const store = new JsonStore(dataFile, publicOrigin);
const previews = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload), ...headers });
  res.end(payload);
}

function text(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

async function bodyJson(req, limit = 1_000_000) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function b64(value) { return Buffer.from(value).toString('base64url'); }
function sign(value) { return createHmac('sha256', sessionSecret).update(value).digest('base64url'); }
function makeSession() {
  const payload = b64(JSON.stringify({ email: accountEmail, exp: Date.now() + 7 * 24 * 3600_000 }));
  return `${payload}.${sign(payload)}`;
}
function readCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(pair => {
    const index = pair.indexOf('='); return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
  }));
}
function authenticated(req) {
  const token = readCookies(req).keepwell_session;
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { const value = JSON.parse(Buffer.from(payload, 'base64url')); return value.email === accountEmail && value.exp > Date.now(); }
  catch { return false; }
}

function loginMatches(email, password) {
  const entered = scryptSync(String(password ?? ''), passwordSalt, 32);
  return String(email ?? '').trim().toLowerCase() === accountEmail && timingSafeEqual(entered, passwordDigest);
}

function safeRemoteHost(hostname) {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) return false;
  if (isIP(lower)) {
    return !/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(lower);
  }
  return true;
}

async function capturePage(address) {
  const demo = demoPageFor(address);
  if (demo) return demo;
  const url = new URL(address);
  if (!safeRemoteHost(url.hostname)) throw new Error('This address cannot be fetched by Keepwell.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'KeepwellBookmarkBot/1.0' } });
    if (!response.ok) throw new Error(`Page returned ${response.status}.`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error('Page is not readable HTML.');
    const reader = response.body.getReader(); const chunks = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength; if (total > 2_000_000) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))));
    return extractPage(html, response.url);
  } finally { clearTimeout(timer); }
}

function cleanupPreviews() {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [key, value] of previews) if (value.createdAt < cutoff) previews.delete(key);
}

async function previewAddress(address) {
  const parsed = parseWebAddress(address);
  if (!parsed.ok) throw Object.assign(new Error(parsed.error), { status: 400 });
  const normalized = normalizeUrl(address);
  const existing = (await store.list()).find(bookmark => bookmark.normalizedUrl === normalized);
  if (existing) return { kind: 'duplicate', bookmark: publicBookmark(existing) };
  let details = null; let reachable = true;
  try { details = await capturePage(parsed.url.href); } catch { reachable = false; }
  const token = randomBytes(18).toString('base64url');
  previews.set(token, { createdAt: Date.now(), url: parsed.url.href, normalized, reachable, details });
  return reachable ? { kind: 'review', token, url: parsed.url.href, details: { title: details.title, description: details.description, icon: details.icon, image: details.image } }
    : { kind: 'unreachable', token, url: parsed.url.href };
}

async function retryPending() {
  const bookmarks = await store.list();
  for (const bookmark of bookmarks.filter(item => item.capture?.status === 'pending')) {
    try {
      const details = await capturePage(bookmark.url);
      await store.mutate(state => {
        const current = state.bookmarks.find(item => item.id === bookmark.id);
        if (!current || current.capture?.status !== 'pending') return;
        applyRecoveredDetails(current, details);
      });
    } catch {
      await store.mutate(state => {
        const current = state.bookmarks.find(item => item.id === bookmark.id);
        if (current?.capture?.status === 'pending') {
          current.capture.attempts = (current.capture.attempts || 0) + 1;
          current.capture.lastAttemptAt = new Date().toISOString();
        }
      });
    }
  }
}

function routeMatch(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean), patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    if (patternParts[index].startsWith(':')) params[patternParts[index].slice(1)] = decodeURIComponent(pathParts[index]);
    else if (patternParts[index] !== pathParts[index]) return null;
  }
  return params;
}

async function api(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await bodyJson(req);
    if (!loginMatches(body.email, body.password)) return json(res, 401, { error: 'Check your email and password, then try again.' });
    return json(res, 200, { ok: true }, { 'set-cookie': `keepwell_session=${encodeURIComponent(makeSession())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` });
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    return json(res, 200, { ok: true }, { 'set-cookie': 'keepwell_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }
  if (req.method === 'GET' && url.pathname === '/api/session') return json(res, 200, { authenticated: authenticated(req), email: authenticated(req) ? accountEmail : null });
  if (!authenticated(req)) return json(res, 401, { error: 'Sign in to continue.' });

  if (req.method === 'GET' && url.pathname === '/api/bookmarks') {
    const all = await store.list();
    const section = url.searchParams.get('section');
    const query = url.searchParams.get('q') || '';
    let chosen = section === 'later' ? all.filter(item => item.readLater) : all;
    let interpretation = [];
    if (query.trim()) {
      try { const result = searchBookmarks(chosen, query); chosen = result.bookmarks; interpretation = result.interpretation; }
      catch (error) { if (error instanceof SearchSyntaxError) return json(res, 400, { error: error.message }); throw error; }
    }
    const tags = uniqueTags(all.flatMap(item => item.tags)).sort();
    return json(res, 200, { bookmarks: chosen.map(publicBookmark), total: all.length, readLaterCount: all.filter(item => item.readLater).length, tags, interpretation });
  }
  if (req.method === 'POST' && url.pathname === '/api/bookmarks/preview') {
    cleanupPreviews();
    const body = await bodyJson(req);
    try { return json(res, 200, await previewAddress(body.url)); }
    catch (error) { return json(res, error.status || 500, { error: error.message || 'Could not inspect this address.' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/bookmarks') {
    const body = await bodyJson(req); const preview = previews.get(body.token);
    if (!preview) return json(res, 400, { error: 'This save preview expired. Please paste the address again.' });
    const existing = (await store.list()).find(item => item.normalizedUrl === preview.normalized);
    if (existing) return json(res, 409, { error: 'This address is already in your library.', bookmark: publicBookmark(existing) });
    const title = String(body.title ?? '').trim();
    if (!title) return json(res, 400, { error: 'Add a title before saving.' });
    const bookmark = makeBookmark({
      url: preview.url, details: preview.details, title, description: String(body.description ?? ''), notes: body.notes,
      tags: body.tags, readLater: body.readLater, captureStatus: preview.reachable ? 'ready' : 'pending'
    });
    await store.mutate(state => state.bookmarks.unshift(bookmark)); previews.delete(body.token);
    return json(res, 201, { bookmark: publicBookmark(bookmark) });
  }
  if (req.method === 'POST' && url.pathname === '/api/retry-pending') { await retryPending(); return json(res, 200, { ok: true }); }

  let params = routeMatch(url.pathname, '/api/bookmarks/:id');
  if (params && req.method === 'PATCH') {
    const body = await bodyJson(req);
    const updated = await store.mutate(state => {
      const bookmark = state.bookmarks.find(item => item.id === params.id);
      if (!bookmark) return null;
      if ('title' in body) { const title = String(body.title).trim(); if (!title) throw Object.assign(new Error('Add a title before saving.'), { status: 400 }); bookmark.title = title; bookmark.titleEdited = true; }
      if ('description' in body) { bookmark.description = String(body.description ?? '').trim(); bookmark.descriptionEdited = true; }
      if ('notes' in body) bookmark.notes = String(body.notes ?? '').trim();
      if ('tags' in body) bookmark.tags = uniqueTags(body.tags);
      if ('readLater' in body) bookmark.readLater = Boolean(body.readLater);
      bookmark.updatedAt = new Date().toISOString();
      return bookmark;
    });
    if (!updated) return json(res, 404, { error: 'Bookmark not found.' });
    return json(res, 200, { bookmark: publicBookmark(updated) });
  }
  if (params && req.method === 'DELETE') {
    const removed = await store.mutate(state => {
      const index = state.bookmarks.findIndex(item => item.id === params.id);
      if (index < 0) return false; state.bookmarks.splice(index, 1); return true;
    });
    return removed ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Bookmark not found.' });
  }
  params = routeMatch(url.pathname, '/api/bookmarks/:id/archive');
  if (params && req.method === 'GET') {
    const bookmark = await store.find(params.id);
    if (!bookmark) return json(res, 404, { error: 'Bookmark not found.' });
    if (bookmark.capture?.status !== 'ready') return json(res, 409, { error: 'A saved copy is not ready yet.' });
    return json(res, 200, { archive: bookmark.capture });
  }
  return json(res, 404, { error: 'Not found.' });
}

function demoHtml(slug) {
  const page = ({ rome: { title: 'A local’s walking guide to Rome', deck: 'Quiet streets, timeless landmarks, and neighborhood stops for exploring Rome on foot.', body: ['Begin before the streets fill, when shutters are lifting and the first coffee cups reach the counters.', 'Cross the river by the oldest bridge you can find, then follow the shaded lanes.'] }, water: { title: 'How ancient cities managed water', deck: 'Aqueducts, fountains, and daily life in Rome.', body: ['Water shaped the ancient city one channel at a time.', 'Public fountains made engineering part of daily civic life.'] }, trees: { title: 'Why old city trees outlive the streets around them', deck: 'A field report on roots, stonework, and ancient urban trees.', body: ['At the center of the oldest square, paving bends around a plane tree.', 'Preserving these trees means preserving a living record.'] } })[slug];
  if (!page) return null;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${page.title}</title><meta name="description" content="${page.deck}"><meta name="author" content="Keepwell Demo Press"><style>body{margin:0;background:#f8f4eb;color:#2c2923;font-family:Georgia,serif}header{padding:22px 6vw;background:#fff;border-bottom:1px solid #ddd;font-family:system-ui;color:#7c3f24;font-weight:800}article{width:min(700px,88vw);margin:50px auto}h1{font-size:clamp(38px,7vw,62px);line-height:1.03;font-weight:500}.deck{font-size:21px;color:#615c54;line-height:1.5}.hero{height:250px;border-radius:12px;background:linear-gradient(145deg,#d8c5a6,#9aac9c,#5d745f)}p{font-size:18px;line-height:1.75}</style></head><body><header>Keepwell Demo Press</header><article><h1>${page.title}</h1><p class="deck">${page.deck}</p><div class="hero"></div>${page.body.map(p => `<p>${p}</p>`).join('')}</article></body></html>`;
}

async function staticFile(req, res, url) {
  const demo = routeMatch(url.pathname, '/demo/original/:slug');
  if (demo) {
    if (demo.slug === 'trees') return text(res, 410, '<h1>This article is no longer available</h1>', 'text/html; charset=utf-8');
    const html = demoHtml(demo.slug); return html ? text(res, 200, html, 'text/html; charset=utf-8') : text(res, 404, 'Not found');
  }
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const target = resolve(publicDir, `.${pathname}`);
  if (!target.startsWith(resolve(publicDir))) return text(res, 403, 'Forbidden');
  try {
    const info = await stat(target); if (!info.isFile()) throw new Error('not file');
    const data = await readFile(target); res.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream', 'content-length': data.length }); res.end(data);
  } catch {
    if (!extname(pathname)) {
      const data = await readFile(join(publicDir, 'index.html')); res.writeHead(200, { 'content-type': mime['.html'], 'content-length': data.length }); res.end(data);
    } else text(res, 404, 'Not found');
  }
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await staticFile(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong.' });
    else res.end();
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await store.load();
  const timer = setInterval(() => retryPending().catch(console.error), 60_000); timer.unref();
  server.listen(port, host, () => console.log(`Keepwell listening on http://${host}:${port}`));
}
