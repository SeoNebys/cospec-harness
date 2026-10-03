import dns from 'node:dns/promises';
import net from 'node:net';
import { parseHttpUrl } from './domain.js';

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function privateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
}

async function assertPublic(url) {
  if (['localhost', 'localhost.localdomain'].includes(url.hostname.toLowerCase())) throw new Error('Local network addresses cannot be saved');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => privateAddress(item.address))) throw new Error('Local network addresses cannot be saved');
}

async function safeFetch(target, options, { fetcher, allowPrivate, redirects = 0 }) {
  const url = target instanceof URL ? target : new URL(target);
  if (!allowPrivate) await assertPublic(url);
  const response = await fetcher(url, { ...options, redirect: 'manual' });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 5) throw new Error('The site redirected too many times');
    const location = response.headers.get('location');
    if (!location) throw new Error('The site returned an invalid redirect');
    return safeFetch(new URL(location, url), options, { fetcher, allowPrivate, redirects: redirects + 1 });
  }
  return response;
}

function decode(value = '') {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
}

function attr(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) { const match = html.match(pattern); if (match) return decode(match[1]); }
  return '';
}

function absolute(value, base) { try { return new URL(value, base).toString(); } catch { return ''; } }

function pageDetails(html, url) {
  const title = attr(html, 'og:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') || new URL(url).hostname;
  const description = attr(html, 'description') || attr(html, 'og:description');
  const faviconMatch = html.match(/<link[^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]+href=["']([^"']+)["']/i) || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["']/i);
  const firstImage = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
  const image = absolute(attr(html, 'og:image') || firstImage, url);
  const stripped = html
    .replace(/<(script|style|noscript|svg|form|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decode(stripped).slice(0, 120000);
  return { title, description, favicon: absolute(faviconMatch?.[1] || '/favicon.ico', url), image, text };
}

export async function captureUrl(input, { fetcher = fetch, allowPrivate = false } = {}) {
  const url = parseHttpUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await safeFetch(url, { signal: controller.signal, headers: { 'user-agent': 'KeptBookmarks/1.0 (+personal bookmark archiver)', accept: 'text/html,application/pdf;q=0.9,*/*;q=0.1' } }, { fetcher, allowPrivate });
    if (!response.ok) throw new Error(`The site responded with ${response.status}`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BYTES) throw new Error('The response is too large to preserve');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) throw new Error('The response is too large to preserve');
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const finalUrl = response.url || url.toString();
    if (contentType.includes('application/pdf') || buffer.subarray(0, 4).toString() === '%PDF') {
      const name = decodeURIComponent(new URL(finalUrl).pathname.split('/').pop() || 'saved-document.pdf');
      return { title: name.replace(/\.pdf$/i, '') || 'Saved PDF', description: 'Saved PDF document', favicon: '', capture: { status: 'ready', type: 'pdf', savedAt: new Date().toISOString(), sourceUrl: url.toString(), filename: name.endsWith('.pdf') ? name : `${name}.pdf`, mime: 'application/pdf', data: buffer.toString('base64') } };
    }
    const html = buffer.toString('utf8');
    const details = pageDetails(html, finalUrl);
    let savedImage = '';
    if (details.image) {
      try {
        const imageUrl = new URL(details.image);
        const imageResponse = await safeFetch(imageUrl, { signal: controller.signal, headers: { 'user-agent': 'KeptBookmarks/1.0 (+personal bookmark archiver)', accept: 'image/*' } }, { fetcher, allowPrivate });
        const imageType = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase();
        const imageLength = Number(imageResponse.headers.get('content-length') || 0);
        if (imageResponse.ok && imageType.startsWith('image/') && imageLength <= MAX_IMAGE_BYTES) {
          const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
          if (imageBytes.byteLength <= MAX_IMAGE_BYTES) savedImage = `data:${imageType};base64,${imageBytes.toString('base64')}`;
        }
      } catch { /* The readable text capture is still useful when an image cannot be preserved. */ }
    }
    return { title: details.title, description: details.description, favicon: details.favicon, capture: { status: 'ready', type: 'page', savedAt: new Date().toISOString(), sourceUrl: url.toString(), title: details.title, description: details.description, image: savedImage, text: details.text } };
  } finally { clearTimeout(timeout); }
}

export function failedCapture(error) {
  return { status: 'failed', type: 'page', savedAt: null, reason: error instanceof Error ? error.message : String(error) };
}
