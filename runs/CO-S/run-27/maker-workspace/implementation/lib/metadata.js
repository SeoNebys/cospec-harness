import { siteName, canonicalAddress } from './url.js';

function decode(value = '') {
  return value.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
}

function contentFor(html, key, value) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match => [match[1].toLowerCase(), match[2]]));
    if (attrs[key] && attrs[key].toLowerCase() === value && attrs.content) return decode(attrs.content);
  }
  return '';
}

export function extractMetadata(html, address) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = contentFor(html, 'property', 'og:title') || decode(titleMatch?.[1] || '') || siteName(address);
  const description = contentFor(html, 'property', 'og:description') || contentFor(html, 'name', 'description');
  return { title: title.slice(0, 500), description: description.slice(0, 2000) };
}

export async function fetchMetadata(address, fetchImpl = fetch) {
  const url = canonicalAddress(address);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'Keeplist Bookmark Manager/1.0', accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('Page does not provide HTML details');
    const html = (await response.text()).slice(0, 1_500_000);
    return { ...extractMetadata(html, url), fetched: true };
  } catch {
    return { title: siteName(url), description: '', fetched: false };
  } finally { clearTimeout(timeout); }
}
