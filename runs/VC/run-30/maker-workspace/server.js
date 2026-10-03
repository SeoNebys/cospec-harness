const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

const clean = (value = '') => value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
function getMeta(html, key) {
  for (const tag of html.match(/<meta\s+[^>]*>/gi) || []) {
    const attrs = {}; tag.replace(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi, (_, k, q, v) => (attrs[k.toLowerCase()] = v));
    if ((attrs.property || attrs.name)?.toLowerCase() === key) return clean(attrs.content);
  }
  return '';
}
async function metadata(req, res) {
  try {
    const target = new URL(new URL(req.url, 'http://local').searchParams.get('url'));
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only web links are supported');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(target, { signal: controller.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 Shelf/1.0', accept: 'text/html' } }); clearTimeout(timer);
    if (!response.ok) throw new Error(`The page returned ${response.status}`);
    const html = (await response.text()).slice(0, 1000000);
    const title = getMeta(html, 'og:title') || getMeta(html, 'twitter:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const description = getMeta(html, 'og:description') || getMeta(html, 'description') || getMeta(html, 'twitter:description');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); return res.end(JSON.stringify({ title, description, url: response.url }));
  } catch (error) {
    res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' }); return res.end(JSON.stringify({ error: error.name === 'AbortError' ? 'The page took too long to respond' : error.message }));
  }
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/metadata?')) return metadata(req, res);
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const target = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!target.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(4000, '0.0.0.0', () => console.log('Shelf running on http://0.0.0.0:4000'));
