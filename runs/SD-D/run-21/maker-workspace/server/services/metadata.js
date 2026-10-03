import * as cheerio from 'cheerio';

// Pure extractor (unit-testable, no network): parse metadata out of HTML.
// FR-002; returns nulls for anything absent so saving can fall back (FR-004).
export function extractMetadata(html, baseUrl) {
  const result = { url: baseUrl, title: null, description: null, iconUrl: null, previewImageUrl: null };
  const $ = cheerio.load(html || '');
  const meta = (sel, attr = 'content') => {
    const el = $(sel).first();
    const v = el && el.attr(attr);
    return v && v.trim() ? v.trim() : null;
  };

  result.title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    ($('title').first().text().trim() || null);
  result.description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    meta('meta[name="description"]');
  result.previewImageUrl =
    meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');

  const iconHref =
    meta('link[rel="icon"]', 'href') ||
    meta('link[rel="shortcut icon"]', 'href') ||
    meta('link[rel="apple-touch-icon"]', 'href');
  try {
    result.iconUrl = iconHref ? new URL(iconHref, baseUrl).href : new URL('/favicon.ico', baseUrl).href;
    if (result.previewImageUrl) {
      result.previewImageUrl = new URL(result.previewImageUrl, baseUrl).href;
    }
  } catch {
    // ignore URL resolution failures
  }
  return result;
}

// Best-effort fetch + extract. Never throws (FR-004).
export async function fetchMetadata(url) {
  const empty = { url, title: null, description: null, iconUrl: null, previewImageUrl: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+metadata)' },
    });
    clearTimeout(timer);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) return empty; // e.g. a PDF — nothing to parse
    const html = await res.text();
    return extractMetadata(html, res.url || url);
  } catch {
    return empty; // Unreachable/blocked page (FR-004).
  }
}
