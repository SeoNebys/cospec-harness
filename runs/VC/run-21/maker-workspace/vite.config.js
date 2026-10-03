import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const decodeEntities = (value = '') => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/\s+/g, ' ')
  .trim();

const getMeta = (html, key) => {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  const tag = tags.find((item) => {
    const property = item.match(/(?:property|name)=["']([^"']+)["']/i)?.[1];
    return property?.toLowerCase() === key.toLowerCase();
  });
  return decodeEntities(tag?.match(/content=["']([^"']*)["']/i)?.[1] || '');
};

function metadataPlugin() {
  return {
    name: 'bookmark-metadata',
    configureServer(server) {
      server.middlewares.use('/api/metadata', async (request, response) => {
        response.setHeader('Content-Type', 'application/json');
        try {
          const requestUrl = new URL(request.url, 'http://localhost');
          const target = new URL(requestUrl.searchParams.get('url'));
          if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported URL');
          if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(target.hostname)) throw new Error('Private URL');

          const upstream = await fetch(target, {
            redirect: 'follow',
            signal: AbortSignal.timeout(7000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Keepr/1.0; +bookmark-preview)' }
          });
          if (!upstream.ok) throw new Error(`Page returned ${upstream.status}`);
          const type = upstream.headers.get('content-type') || '';
          if (!type.includes('text/html')) throw new Error('Not an HTML page');
          const html = (await upstream.text()).slice(0, 1_000_000);
          const title = getMeta(html, 'og:title') || getMeta(html, 'twitter:title') || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
          const description = getMeta(html, 'og:description') || getMeta(html, 'description') || getMeta(html, 'twitter:description');
          response.end(JSON.stringify({ title: title.slice(0, 180), description: description.slice(0, 360), hostname: target.hostname.replace(/^www\./, '') }));
        } catch (error) {
          response.statusCode = 422;
          response.end(JSON.stringify({ error: 'We could not read this page automatically.' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), metadataPlugin()]
});
