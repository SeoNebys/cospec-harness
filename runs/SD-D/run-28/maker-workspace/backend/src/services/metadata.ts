import * as cheerio from 'cheerio';

export interface FetchedPage {
  ok: boolean;
  contentType: string;
  url?: string; // final URL after redirects (base for resolving assets)
  body?: string; // present for HTML
  bytes?: Buffer; // present for non-HTML (e.g. PDF)
  status?: number;
  error?: string;
}

const UA = 'BookmarkManager/1.0 (+local single-user app)';

/** Fetch a URL with a timeout, returning text for HTML and bytes otherwise. */
export async function fetchPage(url: string, timeoutMs = 12000): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: '*/*' },
    });
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const finalUrl = res.url || url;
    if (!res.ok) {
      return { ok: false, contentType, url: finalUrl, status: res.status, error: `HTTP ${res.status}` };
    }
    if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
      const buf = Buffer.from(await res.arrayBuffer());
      return { ok: true, contentType: 'application/pdf', url: finalUrl, bytes: buf, status: res.status };
    }
    const body = await res.text();
    return { ok: true, contentType, url: finalUrl, body, status: res.status };
  } catch (err) {
    return {
      ok: false,
      contentType: '',
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface PageMetadata {
  title: string | null;
  description: string | null;
  favicon: string | null;
  previewImage: string | null;
}

/** Parse standard/Open Graph metadata out of an HTML document. */
export function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const $ = cheerio.load(html);
  const pick = (selectors: string[], attr = 'content'): string | null => {
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length) {
        const val = attr === 'text' ? el.text() : el.attr(attr);
        if (val && val.trim()) return val.trim();
      }
    }
    return null;
  };

  const title =
    pick(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ??
    pick(['title'], 'text');

  const description = pick([
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);

  const previewRaw = pick([
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
  ]);

  let faviconRaw =
    $('link[rel="icon"]').attr('href') ??
    $('link[rel="shortcut icon"]').attr('href') ??
    $('link[rel="apple-touch-icon"]').attr('href') ??
    null;
  if (!faviconRaw) faviconRaw = '/favicon.ico';

  const resolve = (href: string | null): string | null => {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };

  return {
    title,
    description,
    favicon: resolve(faviconRaw),
    previewImage: resolve(previewRaw),
  };
}
