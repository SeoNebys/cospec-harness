import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const decode = (value = '') => value
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const clean = (value = '') => decode(value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

function readMeta(html, property) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) attrs[match[1].toLowerCase()] = match[2];
    if (attrs.property?.toLowerCase() === property || attrs.name?.toLowerCase() === property) return clean(attrs.content);
  }
  return '';
}

function metadataPlugin() {
  return {
    name: 'bookmark-metadata',
    configureServer(server) {
      server.middlewares.use('/api/metadata', async (req, res) => {
        try {
          const requestUrl = new URL(req.url, 'http://localhost');
          const target = new URL(requestUrl.searchParams.get('url') || '');
          if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Please enter a web address.');
          if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(target.hostname)) throw new Error('That address cannot be previewed.');
          const response = await fetch(target, {
            redirect: 'follow', signal: AbortSignal.timeout(8000),
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; Markwell/1.0)', accept: 'text/html' }
          });
          if (!response.ok) throw new Error(`The page returned ${response.status}.`);
          if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('This link does not point to a web page.');
          const html = (await response.text()).slice(0, 1_500_000);
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = readMeta(html, 'og:title') || readMeta(html, 'twitter:title') || clean(titleMatch?.[1]);
          const description = readMeta(html, 'og:description') || readMeta(html, 'twitter:description') || readMeta(html, 'description');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ title: title || target.hostname, description, domain: target.hostname.replace(/^www\./, ''), url: target.href }));
        } catch (error) {
          res.statusCode = 422;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message || 'We could not preview that page.' }));
        }
      });
    }
  };
}

export default defineConfig({ plugins: [react(), metadataPlugin()] });
