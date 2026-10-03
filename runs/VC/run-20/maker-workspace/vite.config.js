import { defineConfig } from 'vite';
import dns from 'node:dns/promises';
import net from 'node:net';

const decode = value => value.replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/\s+/g, ' ').trim();
function meta(html, key) {
  const wanted = key.toLowerCase();
  for (const tag of html.match(/<meta\s[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
    if ((attrs.property || attrs.name || '').toLowerCase() === wanted && attrs.content) return decode(attrs.content);
  }
  return '';
}
function isPrivate(ip) {
  if (net.isIPv4(ip)) return /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:');
}
async function metadataHandler(req, res) {
  try {
    const input = new URL(req.url, 'http://keepmark.local').searchParams.get('url');
    const target = new URL(input);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only web links are supported');
    const addresses = await dns.lookup(target.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivate(address))) throw new Error('That address cannot be fetched');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(target, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; Keepmark/1.0)', accept: 'text/html,application/xhtml+xml' } });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`The page returned ${response.status}`);
    if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('This link is not an HTML page');
    const html = (await response.text()).slice(0, 1_500_000);
    const title = decode(meta(html, 'og:title') || meta(html, 'twitter:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const rawDescription = meta(html, 'og:description') || meta(html, 'twitter:description') || meta(html, 'description');
    const description = rawDescription.length > 220 ? `${rawDescription.slice(0, 217).replace(/\s+\S*$/, '')}…` : rawDescription;
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ title, description, url: response.url }));
  } catch (error) {
    res.writeHead(422, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error.name === 'AbortError' ? 'The page took too long to respond' : error.message }));
  }
}
const plugin = {
  name: 'keepmark-metadata',
  configureServer(server) { server.middlewares.use('/api/metadata', metadataHandler); },
  configurePreviewServer(server) { server.middlewares.use('/api/metadata', metadataHandler); }
};
export default defineConfig({ plugins: [plugin] });
