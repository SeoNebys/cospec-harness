/**
 * Automatic page-detail fetching (FR-002). Fetches the page and extracts title,
 * description, preview image, and site icon from Open Graph / Twitter / standard
 * meta tags. Best-effort: on any failure the caller keeps the fallback title (FR-004).
 */
import * as cheerio from 'cheerio';

export interface PageMetadata {
  title?: string;
  description?: string;
  previewImage?: string;
  iconUrl?: string;
}

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchMetadata(url: string): Promise<PageMetadata> {
  const res = await fetchWithTimeout(url);
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !contentType.includes('text/html')) return {};

  const html = await res.text();
  const $ = cheerio.load(html);

  const pick = (selectors: string[]): string | undefined => {
    for (const sel of selectors) {
      const el = $(sel).first();
      const val = el.attr('content') ?? el.text();
      if (val && val.trim()) return val.trim();
    }
    return undefined;
  };

  const title =
    pick(['meta[property="og:title"]', 'meta[name="twitter:title"]', 'title']) || undefined;
  const description =
    pick([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]) || undefined;
  const previewImageRaw = pick([
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]);
  const iconHref =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    '/favicon.ico';

  return {
    title,
    description,
    previewImage: previewImageRaw ? absolutize(previewImageRaw, url) : undefined,
    iconUrl: absolutize(iconHref, url),
  };
}

function absolutize(maybeRelative: string, base: string): string | undefined {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return undefined;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
  } finally {
    clearTimeout(timer);
  }
}
