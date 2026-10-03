import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import { createServer as createViteServer } from 'vite';
import * as cheerio from 'cheerio';

const PORT = 4000;
const MAX_HTML_BYTES = 2_000_000;
const cache = new Map();

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return value === '::1' || value === '::' || value.startsWith('fc') ||
      value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') ||
      value.startsWith('fea') || value.startsWith('feb') || value.startsWith('ff');
  }
  return true;
}

async function validatePublicUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS links are supported.');
  if (parsed.username || parsed.password) throw new Error('Links with credentials are not supported.');
  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('That address is not publicly accessible.');
  }
  return parsed;
}

async function fetchPage(startUrl) {
  let current = startUrl;
  for (let redirects = 0; redirects < 5; redirects += 1) {
    await validatePublicUrl(current);
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Nestmark/1.0; +https://nestmark.app)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The page redirected without a destination.');
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('That link does not point to a web page.');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error('That page is too large to preview.');
      }
      chunks.push(value);
    }
    return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: current };
  }
  throw new Error('The page redirected too many times.');
}

function clean(value) {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

function extractMetadata(html, finalUrl) {
  const $ = cheerio.load(html);
  const meta = (selectors) => {
    for (const selector of selectors) {
      const value = $(selector).first().attr('content');
      if (value) return clean(value);
    }
    return '';
  };
  const title = meta([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
  ]) || clean($('title').first().text()) || new URL(finalUrl).hostname;
  const description = meta([
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]) || clean($('main p, article p, body p').first().text()).slice(0, 300);
  const discoveredIcon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first().attr('href');
  const iconPath = discoveredIcon && !discoveredIcon.startsWith('data:') ? discoveredIcon : '/favicon.ico';
  const icon = new URL(iconPath, finalUrl).href;
  const canonical = $('link[rel="canonical"]').first().attr('href');
  return {
    title: title.slice(0, 180),
    description: description.slice(0, 500),
    icon,
    url: canonical ? new URL(canonical, finalUrl).href : finalUrl,
    domain: new URL(finalUrl).hostname.replace(/^www\./, ''),
  };
}

async function metadataHandler(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const rawUrl = requestUrl.searchParams.get('url');
    if (!rawUrl) throw new Error('A URL is required.');
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const cached = cache.get(normalized);
    if (cached && Date.now() - cached.timestamp < 15 * 60_000) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(cached.data));
    }
    const { html, finalUrl } = await fetchPage(normalized);
    const data = extractMetadata(html, finalUrl);
    cache.set(normalized, { timestamp: Date.now(), data });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'The page took too long to respond.' : error.message;
    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: message || 'We could not read that page.' }));
  }
}

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url?.startsWith('/api/metadata')) return metadataHandler(req, res);
  vite.middlewares(req, res, () => {
    res.writeHead(404);
    res.end('Not found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nestmark is ready on http://0.0.0.0:${PORT}`);
});
