import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import net from 'node:net';

const entityMap = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
const decodeEntities = (text = '') => text
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (match, name) => entityMap[name.toLowerCase()] ?? match)
  .replace(/\s+/g, ' ')
  .trim();

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function metaValue(html, keys) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (keys.includes(key) && attrs.content) return decodeEntities(attrs.content);
  }
  return '';
}

function linkValue(html, rels) {
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const rel = (attrs.rel || '').toLowerCase().split(/\s+/);
    if (rels.some(value => rel.includes(value)) && attrs.href) return attrs.href;
  }
  return '';
}

function isUnsafeHost(hostname) {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) return true;
  if (net.isIP(lower)) {
    return lower === '::1' || lower.startsWith('127.') || lower.startsWith('10.') || lower.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(lower) || lower.startsWith('169.254.') || lower === '0.0.0.0';
  }
  return false;
}

function metadataPlugin() {
  return {
    name: 'bookmark-metadata',
    configureServer(server) {
      server.middlewares.use('/api/metadata', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const requestUrl = new URL(req.url, 'http://app.local');
          const target = new URL(requestUrl.searchParams.get('url') || '');
          if (!['http:', 'https:'].includes(target.protocol) || isUnsafeHost(target.hostname) || target.username || target.password) {
            throw new Error('Please enter a public website URL.');
          }

          const response = await fetch(target, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; NestBookmarks/1.0; +https://example.com)',
              Accept: 'text/html,application/xhtml+xml'
            },
            signal: AbortSignal.timeout(9000)
          });
          if (!response.ok) throw new Error(`That page returned ${response.status}.`);
          const type = response.headers.get('content-type') || '';
          if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('That link is not an HTML page.');

          const html = (await response.text()).slice(0, 1_500_000);
          const rawTitle = metaValue(html, ['og:title', 'twitter:title']) || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
          const description = metaValue(html, ['og:description', 'twitter:description', 'description']);
          const iconHref = linkValue(html, ['icon', 'shortcut', 'apple-touch-icon', 'apple-touch-icon-precomposed']);
          const icon = new URL(iconHref && !iconHref.startsWith('data:') ? iconHref : '/favicon.ico', response.url).href;
          res.statusCode = 200;
          res.end(JSON.stringify({ title: rawTitle, description, icon, url: response.url }));
        } catch (error) {
          res.statusCode = 422;
          res.end(JSON.stringify({ error: error.name === 'TimeoutError' ? 'That site took too long to respond.' : error.message || 'Could not read that page.' }));
        }
      });
    }
  };
}

export default defineConfig({ plugins: [react(), metadataPlugin()] });
