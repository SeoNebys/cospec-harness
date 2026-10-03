// Metadata fetch + parse (FR-002, FR-004): title, description, icon, preview.
import { parse } from 'node-html-parser';
import { deriveTitleFromUrl } from './normalize.js';

const FETCH_TIMEOUT_MS = 8000;

function absolutize(base, maybeUrl) {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, base).href;
  } catch {
    return null;
  }
}

/**
 * Parse an HTML string for metadata. Exposed for unit testing.
 * Returns { title, description, iconUrl, previewImageUrl, fallbacksUsed }.
 */
export function parseMetadataFromHtml(html, baseUrl) {
  const root = parse(html || '');
  const fallbacksUsed = [];

  const meta = (selector, attr = 'content') => {
    const el = root.querySelector(selector);
    return el ? el.getAttribute(attr) : null;
  };

  let title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    (root.querySelector('title')?.text || '').trim() ||
    null;
  if (!title) {
    title = deriveTitleFromUrl(baseUrl);
    fallbacksUsed.push('title');
  }

  let description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    meta('meta[name="description"]') ||
    null;
  if (!description) fallbacksUsed.push('description');

  let previewImageUrl =
    absolutize(baseUrl, meta('meta[property="og:image"]')) ||
    absolutize(baseUrl, meta('meta[name="twitter:image"]')) ||
    null;
  if (!previewImageUrl) fallbacksUsed.push('previewImage');

  // Icon: prefer explicit <link rel="icon">, else /favicon.ico.
  let iconHref = null;
  for (const link of root.querySelectorAll('link')) {
    const rel = (link.getAttribute('rel') || '').toLowerCase();
    if (rel.includes('icon')) {
      iconHref = link.getAttribute('href');
      break;
    }
  }
  let iconUrl = absolutize(baseUrl, iconHref);
  if (!iconUrl) {
    iconUrl = absolutize(baseUrl, '/favicon.ico');
    fallbacksUsed.push('icon');
  }

  return {
    title: title ? title.trim() : title,
    description: description ? description.trim() : null,
    iconUrl,
    previewImageUrl,
    fallbacksUsed,
  };
}

/**
 * Fetch a URL and extract metadata. Never throws for network problems;
 * returns { fetched:false } with a derived title so the save can proceed.
 */
export async function fetchMetadata(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+local)' },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('text/html')) {
      return {
        fetched: false,
        title: deriveTitleFromUrl(url),
        description: null,
        iconUrl: null,
        previewImageUrl: null,
        fallbacksUsed: ['title', 'description', 'icon', 'previewImage'],
      };
    }
    const html = await res.text();
    return { fetched: true, ...parseMetadataFromHtml(html, url) };
  } catch {
    return {
      fetched: false,
      title: deriveTitleFromUrl(url),
      description: null,
      iconUrl: null,
      previewImageUrl: null,
      fallbacksUsed: ['title', 'description', 'icon', 'previewImage'],
    };
  } finally {
    clearTimeout(timer);
  }
}
