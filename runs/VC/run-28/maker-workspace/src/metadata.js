import * as cheerio from 'cheerio';
import { ensureProtocol, extractDomain } from './url.js';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 BookmarkManager/1.0';

function absolutize(base, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return '';
  }
}

function pick($, selectors) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const val = (el.attr('content') || el.text() || '').trim();
    if (val) return val;
  }
  return '';
}

// Fetch a page and extract title, description, favicon and preview image.
// Never throws: on failure it returns best-effort fields derived from the URL
// so the caller can still create/update the bookmark.
export async function fetchMetadata(rawUrl) {
  const url = ensureProtocol(rawUrl);
  const domain = extractDomain(url);
  const fallback = {
    title: '',
    description: '',
    favicon: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '',
    preview_image: '',
    fetched: false,
  };

  let res;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    clearTimeout(timer);
  } catch {
    return fallback;
  }

  if (!res.ok) return fallback;
  const ctype = res.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml/i.test(ctype)) return fallback;

  let html;
  try {
    html = await res.text();
  } catch {
    return fallback;
  }

  const baseUrl = res.url || url;
  const $ = cheerio.load(html);

  const title =
    pick($, ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'title']) ||
    fallback.title;

  const description = pick($, [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);

  const preview_image = absolutize(
    baseUrl,
    pick($, ['meta[property="og:image"]', 'meta[property="og:image:url"]', 'meta[name="twitter:image"]'])
  );

  // Favicon: prefer declared icons, else fall back to the Google service.
  let favicon = '';
  const iconHref =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    '';
  if (iconHref) favicon = absolutize(baseUrl, iconHref);
  if (!favicon) favicon = fallback.favicon;

  return { title, description, favicon, preview_image, fetched: true };
}
