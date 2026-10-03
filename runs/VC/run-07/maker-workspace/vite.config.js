import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dns from 'node:dns/promises';
import net from 'node:net';

const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
function pick(html, patterns) { for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return decode(match[1].replace(/<[^>]+>/g, '').trim()); } return ''; }
function isPrivate(address) { return net.isIP(address) && (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|::1$|fc|fd|fe80)/i.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address)); }

function metadataPlugin() {
  return { name: 'bookmark-metadata', configureServer(server) {
    server.middlewares.use('/api/metadata', async (req, res) => {
      try {
        const target = new URL(new URL(req.url, 'http://local').searchParams.get('url'));
        if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only web addresses are supported');
        const addresses = await dns.resolve(target.hostname);
        if (addresses.some(isPrivate)) throw new Error('Private network addresses are not allowed');
        const response = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; KeptBookmarkBot/1.0)', accept: 'text/html' } });
        if (!response.ok) throw new Error(`Page returned ${response.status}`);
        if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('This address is not an HTML page');
        const html = (await response.text()).slice(0, 1_500_000);
        const title = pick(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i, /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i, /<title[^>]*>([\s\S]*?)<\/title>/i]);
        const description = pick(html, [/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i, /<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i]);
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ title, description, domain: target.hostname.replace(/^www\./, '') }));
      } catch (error) { res.statusCode = 422; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error.message || 'Could not read this page' })); }
    });
  }};
}
export default defineConfig({ plugins: [react(), metadataPlugin()] });
