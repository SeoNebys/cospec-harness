import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const port = 4000;
const root = join(process.cwd(), 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

const decode = (value = '') => value
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, ' ').trim();

function metaContent(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decode(match[1]);
    }
  }
  return '';
}

function linkHref(html, relPattern) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const link of links) {
    const rel = link.match(/\brel=["']([^"']+)["']/i)?.[1] || '';
    if (!relPattern.test(rel)) continue;
    const href = link.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) return decode(href);
  }
  return '';
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:');
}

async function fetchMetadata(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web links are supported.');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error('That address cannot be fetched.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      redirect: 'follow', signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; KeptBookmarkBot/1.0)', accept: 'text/html,application/xhtml+xml' }
    });
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('This link is not an HTML page.');
    const html = (await response.text()).slice(0, 1500000);
    const finalUrl = new URL(response.url);
    const rawTitle = metaContent(html, ['og:title', 'twitter:title']) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
    const iconPath = linkHref(html, /(?:^|\s)(?:icon|shortcut icon|apple-touch-icon)(?:\s|$)/i);
    let icon = '';
    try { icon = iconPath ? new URL(iconPath, finalUrl).href : new URL('/favicon.ico', finalUrl).href; } catch {}
    return { title: decode(rawTitle), description, icon, url: finalUrl.href };
  } finally { clearTimeout(timer); }
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    if (requestUrl.pathname === '/api/metadata') {
      const target = requestUrl.searchParams.get('url');
      if (!target) throw new Error('A URL is required.');
      const data = await fetchMetadata(target);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(data));
      return;
    }
    const relative = normalize(decodeURIComponent(requestUrl.pathname)).replace(/^([.][.][/\\])+/, '');
    let filePath = join(root, relative === '/' ? 'index.html' : relative);
    try { if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html'); }
    catch { filePath = join(root, 'index.html'); }
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (error) {
    const isApi = req.url?.startsWith('/api/');
    res.writeHead(isApi ? 422 : 500, { 'content-type': isApi ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' });
    res.end(isApi ? JSON.stringify({ error: error.name === 'AbortError' ? 'That page took too long to respond.' : error.message }) : 'Unable to load the app.');
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Kept is ready on port ${port}`));
