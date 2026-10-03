import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dns from 'node:dns/promises';
import net from 'node:net';

const decode = value => (value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim();
const meta = (html, names) => {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'), new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')];
    for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return decode(match[1]); }
  }
  return '';
};
const isPrivate = address => !net.isIP(address) || /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) || address === '::1';

function metadataPlugin() {
  return { name: 'bookmark-metadata', configureServer(server) {
    server.middlewares.use('/api/metadata', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const input = new URL(req.url, 'http://local').searchParams.get('url');
        const target = new URL(input);
        if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only web links are supported');
        const resolved = await dns.lookup(target.hostname);
        if (isPrivate(resolved.address)) throw new Error('Private network addresses are not supported');
        const response = await fetch(target, { redirect:'follow', signal:AbortSignal.timeout(8000), headers:{'User-Agent':'Mozilla/5.0 (compatible; StashBookmarkBot/1.0)','Accept':'text/html'} });
        if (!response.ok) throw new Error(`Page returned ${response.status}`);
        if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('This link is not an HTML page');
        const html = (await response.text()).slice(0, 800000);
        const title = meta(html, ['og:title','twitter:title']) || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
        const description = meta(html, ['og:description','twitter:description','description']);
        const image = meta(html, ['og:image','twitter:image']);
        const keywords = meta(html, ['keywords']).split(',').map(x=>x.trim()).filter(Boolean).slice(0,3);
        res.end(JSON.stringify({title:title || target.hostname.replace(/^www\./,''),description,image,domain:target.hostname.replace(/^www\./,''),finalUrl:response.url,keywords}));
      } catch (error) { res.statusCode=422; res.end(JSON.stringify({error:error.message || 'Could not read this page'})); }
    });
  }};
}

export default defineConfig({plugins:[react(),metadataPlugin()]});
