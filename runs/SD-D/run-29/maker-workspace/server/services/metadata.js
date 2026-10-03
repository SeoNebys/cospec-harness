// Best-effort metadata capture for the pre-save review step. Fetches the page
// server-side (short timeout) and reads standard head tags + Open Graph. On any
// failure it returns fallback details so the review form is always populated.
import { parse as parseHtml } from 'node-html-parser';
import { deriveTitle } from './url.js';

const FETCH_TIMEOUT_MS = 8000;

function absolutize(base, maybeRelative) {
  if (!maybeRelative) return null;
  try { return new URL(maybeRelative, base).toString(); } catch { return null; }
}

export async function fetchMetadata(normalizedUrl) {
  const fallback = {
    title: deriveTitle(normalizedUrl),
    description: '',
    favicon_url: absolutize(normalizedUrl, '/favicon.ico'),
    preview_image_url: null,
    fallback: true,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(normalizedUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+metadata)' },
    });
    if (!res.ok) return fallback;
    const finalUrl = res.url || normalizedUrl;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) {
      // Non-HTML (e.g. a PDF): use a filename-derived title, no HTML metadata.
      return { ...fallback, fallback: true };
    }
    const html = await res.text();
    const root = parseHtml(html);

    const metaContent = (selector, attr = 'content') => {
      const el = root.querySelector(selector);
      return el ? (el.getAttribute(attr) || '').trim() : '';
    };

    const ogTitle = metaContent('meta[property="og:title"]');
    const docTitle = (root.querySelector('title')?.text || '').trim();
    const title = ogTitle || docTitle || fallback.title;

    const description =
      metaContent('meta[property="og:description"]') ||
      metaContent('meta[name="description"]') ||
      '';

    const ogImage =
      metaContent('meta[property="og:image"]') ||
      metaContent('meta[name="twitter:image"]');
    const preview_image_url = absolutize(finalUrl, ogImage);

    // Favicon: prefer declared <link rel="icon"> variants, else /favicon.ico.
    let iconHref = '';
    for (const rel of ['icon', 'shortcut icon', 'apple-touch-icon']) {
      const link = root.querySelector(`link[rel="${rel}"]`);
      if (link && link.getAttribute('href')) { iconHref = link.getAttribute('href'); break; }
    }
    const favicon_url = absolutize(finalUrl, iconHref) || absolutize(finalUrl, '/favicon.ico');

    return { title, description, favicon_url, preview_image_url, fallback: false };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
