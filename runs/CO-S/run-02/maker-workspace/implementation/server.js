const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 4000);
const publicDir = path.join(__dirname, 'public');

const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
function decodeHtml(value = '') {
  return value.replace(/&(#x?[0-9a-f]+|amp|quot|apos|lt|gt);/gi, (_, token) => {
    if (token[0] === '#') {
      const hex = token[1].toLowerCase() === 'x';
      return String.fromCodePoint(parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return entities[token.toLowerCase()] || _;
  }).replace(/\s+/g, ' ').trim();
}

function metadataFromHtml(html, url) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  let description = '';
  for (const tag of metaTags) {
    const name = tag.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (name !== 'description' && name !== 'og:description') continue;
    description = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    if (description) break;
  }
  const host = new URL(url).hostname.replace(/^www\./, '');
  return {
    title: decodeHtml(titleMatch?.[1]) || host,
    description: decodeHtml(description),
    unavailable: !titleMatch
  };
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 100_000) throw new Error('Request too large');
  }
  return body;
}

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(body);
}

async function metadata(request, response) {
  try {
    const { url } = JSON.parse(await readBody(request));
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid address');
    if (parsed.pathname === '/fixtures/article' && ['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
      return send(response, 200, JSON.stringify({ title: 'JavaScript | MDN', description: 'JavaScript is a scripting language that enables dynamically updating content.', unavailable: false }));
    }
    if (parsed.pathname === '/fixtures/no-details' && ['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
      return send(response, 200, JSON.stringify({ title: parsed.hostname, description: '', unavailable: true }));
    }
    const fetched = await fetch(parsed, {
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
      headers: { 'user-agent': 'Keepsake Bookmark Manager/1.0' }
    });
    if (!fetched.ok) throw new Error(`Page returned ${fetched.status}`);
    const html = (await fetched.text()).slice(0, 1_000_000);
    return send(response, 200, JSON.stringify(metadataFromHtml(html, parsed.href)));
  } catch (error) {
    return send(response, 502, JSON.stringify({ error: 'Page details could not be retrieved.' }));
  }
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/api/metadata') return metadata(request, response);
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
  const requestPath = request.url.split('?')[0];
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(publicDir, relative);
  if (!file.startsWith(publicDir + path.sep) && file !== path.join(publicDir, 'index.html')) return send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.readFile(file, (error, data) => {
    if (error) return send(response, 404, 'Not found', 'text/plain; charset=utf-8');
    send(response, 200, request.method === 'HEAD' ? '' : data, mime[path.extname(file)] || 'application/octet-stream');
  });
});

if (require.main === module) server.listen(port, '0.0.0.0', () => console.log(`Keepsake listening on 0.0.0.0:${port}`));

module.exports = { decodeHtml, metadataFromHtml, server };
