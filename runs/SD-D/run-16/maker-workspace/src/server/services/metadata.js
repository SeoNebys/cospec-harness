// Fetch a page and extract title, description, icon, and preview image.
// Falls back gracefully (address as title) when the page cannot be fetched/parsed.
import * as cheerio from 'cheerio';
import { config } from '../config.js';

function resolveUrl(base, maybeRelative) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return null;
  }
}

export function parseMetadata(html, baseUrl) {
  const $ = cheerio.load(html);
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = $(sel).first();
      const val = el.attr('content') || el.text();
      if (val && val.trim()) return val.trim();
    }
    return null;
  };

  const title =
    pick(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    ($('title').first().text() || '').trim() ||
    null;

  const description = pick([
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);

  // Favicon: prefer explicit link rels, else default /favicon.ico
  let icon = null;
  const iconLink = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first();
  if (iconLink && iconLink.attr('href')) icon = resolveUrl(baseUrl, iconLink.attr('href'));
  if (!icon) icon = resolveUrl(baseUrl, '/favicon.ico');

  const previewRaw = pick(['meta[property="og:image"]', 'meta[name="twitter:image"]']);
  const previewImage = resolveUrl(baseUrl, previewRaw);

  return { title, description, icon, previewImage };
}

export async function fetchMetadata(address) {
  const fallback = { title: null, description: null, icon: null, previewImage: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
    const res = await fetch(address, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return fallback;
    const html = await res.text();
    return parseMetadata(html, res.url || address);
  } catch {
    return fallback; // graceful degradation (FR-003 / FR-037)
  }
}
