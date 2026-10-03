import dns from 'node:dns/promises';
import net from 'node:net';
import { normalizeUrl } from './bookmarks.js';

function privateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
}

async function assertPublic(url) {
  const parsed = new URL(url);
  const answers = await dns.lookup(parsed.hostname, { all: true });
  if (!answers.length || answers.some(answer => privateAddress(answer.address))) throw new Error('That address cannot be fetched.');
}

function decode(value = '') {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
}

function attr(tag, name) { return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? ''; }
function absolute(value, base) { if (!value) return ''; try { return new URL(value, base).toString(); } catch { return ''; } }

export async function fetchMetadata(value, fetcher = fetch) {
  const url = normalizeUrl(value); await assertPublic(url);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'follow', headers: { 'user-agent': 'Keepwell Bookmark Reader/1.0', accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('This address is not a web page.');
    const html = (await response.text()).slice(0, 2_000_000);
    const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
    const meta = key => {
      const tag = metas.find(item => [attr(item, 'property'), attr(item, 'name')].some(name => name.toLowerCase() === key));
      return decode(attr(tag ?? '', 'content'));
    };
    const title = meta('og:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const description = meta('og:description') || meta('description');
    const image = absolute(meta('og:image'), response.url || url);
    const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
    const iconTag = linkTags.find(tag => /(?:^|\s)(?:shortcut\s+)?icon(?:\s|$)/i.test(attr(tag, 'rel')));
    const finalUrl = normalizeUrl(response.url || url);
    return { url: finalUrl, title, description, image, icon: absolute(attr(iconTag ?? '', 'href'), finalUrl), site: new URL(finalUrl).hostname.replace(/^www\./, '') };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The page took too long to respond.');
    throw error;
  } finally { clearTimeout(timeout); }
}
