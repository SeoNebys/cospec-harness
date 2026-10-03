import { parse } from 'node-html-parser';

const FETCH_TIMEOUT_MS = 4000;

// Parse title, description and favicon from a page's HTML.
// `baseUrl` is used to resolve relative favicon paths to absolute URLs.
// Exported for unit testing without network access.
export function parseMetadata(html, baseUrl) {
  const root = parse(html);

  const metaContent = (selector) => {
    const el = root.querySelector(selector);
    const c = el?.getAttribute('content');
    return c ? c.trim() : '';
  };

  const title =
    metaContent('meta[property="og:title"]') ||
    root.querySelector('title')?.text?.trim() ||
    '';

  const description =
    metaContent('meta[property="og:description"]') ||
    metaContent('meta[name="description"]') ||
    '';

  let iconHref = '';
  const iconEl =
    root.querySelector('link[rel="icon"]') ||
    root.querySelector('link[rel="shortcut icon"]') ||
    root.querySelector('link[rel="apple-touch-icon"]');
  if (iconEl) iconHref = iconEl.getAttribute('href') || '';

  let faviconUrl = '';
  try {
    if (iconHref) {
      faviconUrl = new URL(iconHref, baseUrl).href;
    } else {
      faviconUrl = new URL('/favicon.ico', baseUrl).href;
    }
  } catch {
    faviconUrl = '';
  }

  return { title, description, faviconUrl };
}

// Best-effort fetch + parse. Never throws: on timeout, network error, or
// non-HTML content it returns empty fields so saving is never blocked.
export async function collectMetadata(url, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const empty = { title: '', description: '', faviconUrl: '' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+metadata)' },
    });
    if (!res.ok) return empty;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      // Still offer a site-root favicon guess.
      try {
        return { ...empty, faviconUrl: new URL('/favicon.ico', res.url || url).href };
      } catch {
        return empty;
      }
    }
    const html = await res.text();
    return parseMetadata(html, res.url || url);
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}
