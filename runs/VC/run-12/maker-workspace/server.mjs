import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const port = Number(process.env.PORT || 4000);
const root = join(process.cwd(), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (requestUrl.pathname === '/api/metadata') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      return await metadataRoute(requestUrl, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
    return await serveStatic(requestUrl.pathname, req.method, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Something went wrong.' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Markly running on http://0.0.0.0:${port}`));

async function metadataRoute(requestUrl, res) {
  const raw = requestUrl.searchParams.get('url')?.trim();
  if (!raw) return sendJson(res, 400, { error: 'A URL is required.' });

  let target;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported protocol');
    await assertPublicHost(target.hostname);
  } catch {
    return sendJson(res, 400, { error: 'Enter a valid public website URL.' });
  }

  try {
    const { response, finalUrl } = await safeFetch(target);
    const type = response.headers.get('content-type') || '';
    if (!response.ok) throw new Error(`Website returned ${response.status}`);
    if (!type.includes('text/html') && !type.includes('application/xhtml')) throw new Error('URL is not a web page');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 1_500_000) throw new Error('Page is too large');
    const html = await readLimitedText(response, 1_500_000);
    const base = new URL(finalUrl);
    const title = cleanText(
      getMeta(html, 'property', 'og:title') ||
      getMeta(html, 'name', 'twitter:title') ||
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
    );
    const description = cleanText(
      getMeta(html, 'property', 'og:description') ||
      getMeta(html, 'name', 'description') ||
      getMeta(html, 'name', 'twitter:description') || ''
    );
    const iconHref = getIcon(html);
    let icon = new URL('/favicon.ico', base).href;
    if (iconHref) {
      try { icon = new URL(decodeEntities(iconHref), base).href; } catch { /* use fallback */ }
    }
    sendJson(res, 200, { title: title.slice(0, 240), description: description.slice(0, 600), icon, url: base.href, domain: base.hostname.replace(/^www\./, '') });
  } catch (error) {
    sendJson(res, 422, { error: error.message || 'Could not read that page.' });
  }
}

async function safeFetch(initialUrl) {
  let current = initialUrl;
  for (let i = 0; i < 5; i++) {
    await assertPublicHost(current.hostname);
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Markly/1.0; +https://markly.local)', accept: 'text/html,application/xhtml+xml' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Invalid website redirect');
      current = new URL(location, current);
      if (!['http:', 'https:'].includes(current.protocol)) throw new Error('Unsupported website redirect');
      continue;
    }
    return { response, finalUrl: current.href };
  }
  throw new Error('Too many website redirects');
}

async function assertPublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Private host');
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Private address');
}

function isPrivateAddress(address) {
  if (address.includes(':')) {
    const value = address.toLowerCase();
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('::ffff:127.') || value.startsWith('::ffff:10.') || value.startsWith('::ffff:192.168.');
  }
  const [a, b] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function readLimitedText(response, limit) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('Page is too large'); }
    chunks.push(value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

function getMeta(html, attribute, value) {
  for (const match of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = match[0];
    const attrs = parseAttrs(tag);
    if ((attrs[attribute] || '').toLowerCase() === value.toLowerCase() && attrs.content) return attrs.content;
  }
  return '';
}

function getIcon(html) {
  for (const match of html.matchAll(/<link\s+[^>]*>/gi)) {
    const attrs = parseAttrs(match[0]);
    if ((attrs.rel || '').toLowerCase().split(/\s+/).some(v => ['icon', 'shortcut', 'apple-touch-icon'].includes(v)) && attrs.href) return attrs.href;
  }
  return '';
}

function parseAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function cleanText(value) { return decodeEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }
function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10));
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

async function serveStatic(pathname, method, res) {
  let relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  if (!relative || relative === '.') relative = 'index.html';
  let file = join(root, relative);
  if (!file.startsWith(root)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch { file = join(root, 'index.html'); }
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
  res.end(method === 'HEAD' ? undefined : body);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}
