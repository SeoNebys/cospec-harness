// Page-metadata fetching (SCN-001) with graceful fallback (SCN-011).
// Fetches the page and extracts real title/description/preview image/site icon.
// If the page cannot be fetched, returns { failed: true } so the caller can offer
// the save-anyway fallback with a manual title.

import { hostOf, normalizeUrl } from './urls.js';

const PALETTE = ['#2f6fed', '#e0567a', '#2fa96b', '#8b5cf6', '#e08a2f', '#0ea5b7'];
export function colorFor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function firstMatch(html, res) {
  for (const re of res) {
    const m = html.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function decode(s) {
  return String(s)
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export async function fetchMeta(rawUrl, { timeoutMs = 6000, fetchImpl = globalThis.fetch } = {}) {
  const url = normalizeUrl(rawUrl);
  const host = hostOf(url);
  const base = {
    host,
    iconLetter: (host[0] || '?').toUpperCase(),
    color: colorFor(host),
    url,
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const ctype = res.headers.get('content-type') || '';
    if (/application\/pdf/i.test(ctype)) {
      return { ...base, failed: false, title: host + ' (PDF)', description: '', image: '' };
    }
    const html = (await res.text()).slice(0, 500000);
    const ogTitle = firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const title = decode(ogTitle || firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) || host);
    const description = decode(firstMatch(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    ]));
    const image = firstMatch(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]);
    return { ...base, failed: false, title, description, image };
  } catch {
    return { ...base, failed: true, title: '', description: '', image: '' };
  }
}
