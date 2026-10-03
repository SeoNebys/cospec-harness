import { createServer } from 'node:http';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 4000);
const DIST = join(process.cwd(), 'dist');
const MAX_HTML_BYTES = 2_000_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function decodeEntities(value = '') {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function extractMetadata(html, pageUrl) {
  const meta = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !meta[key]) meta[key] = decodeEntities(attrs.content);
  }

  let favicon = '';
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    if (/icon/i.test(attrs.rel || '') && attrs.href) {
      try { favicon = new URL(attrs.href, pageUrl).href; } catch { /* ignore invalid icon */ }
      if (favicon) break;
    }
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return {
    title: meta['og:title'] || meta['twitter:title'] || decodeEntities(titleMatch?.[1] || ''),
    description: meta['og:description'] || meta['twitter:description'] || meta.description || '',
    favicon: favicon || new URL('/favicon.ico', pageUrl).href,
    url: meta['og:url'] ? new URL(meta['og:url'], pageUrl).href : pageUrl,
  };
}

function isPrivateAddress(address) {
  if (!address) return true;
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168);
  }
  const normalizedAddress = address.toLowerCase();
  return normalizedAddress === '::1' || normalizedAddress === '::' || normalizedAddress.startsWith('fc') || normalizedAddress.startsWith('fd') || normalizedAddress.startsWith('fe80:') || normalizedAddress.startsWith('::ffff:127.') || normalizedAddress.startsWith('::ffff:10.') || normalizedAddress.startsWith('::ffff:192.168.');
}

async function validatePublicUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web links are supported.');
  if (url.username || url.password) throw new Error('Links with credentials are not supported.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('That web address uses an unsupported port.');
  const resolved = await lookup(url.hostname, { all: true });
  if (!resolved.length || resolved.some(({ address }) => isPrivateAddress(address))) throw new Error('That address cannot be fetched.');
  return url;
}

async function fetchPage(rawUrl) {
  let current = await validatePublicUrl(rawUrl);
  for (let redirects = 0; redirects < 5; redirects += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': 'KeptBookmarkPreview/1.0 (+metadata fetch)', accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(9000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The page redirected without a destination.');
      current = await validatePublicUrl(new URL(location, current).href);
      continue;
    }
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('That link is not an HTML page.');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_HTML_BYTES) throw new Error('That page is too large to preview.');
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return extractMetadata(html, current.href);
  }
  throw new Error('The page redirected too many times.');
}

async function serveStatic(pathname, response) {
  let relativePath = pathname === '/' ? 'index.html' : normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  if (relativePath.startsWith('..')) relativePath = 'index.html';
  let filePath = join(DIST, relativePath);
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
  } catch {
    filePath = join(DIST, 'index.html');
  }
  const body = await readFile(filePath);
  response.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream', 'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' });
  response.end(body);
}

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (requestUrl.pathname === '/api/metadata') {
      const rawUrl = requestUrl.searchParams.get('url');
      if (!rawUrl) throw new Error('A URL is required.');
      const metadata = await fetchPage(rawUrl);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(metadata));
      return;
    }
    await serveStatic(requestUrl.pathname, response);
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ error: error.name === 'TimeoutError' ? 'The page took too long to respond.' : error.message || 'Could not fetch that page.' }));
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Kept is running on http://0.0.0.0:${PORT}`);
});
