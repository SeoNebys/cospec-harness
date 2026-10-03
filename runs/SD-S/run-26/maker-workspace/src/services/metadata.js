// Parse page details from rendered HTML (research.md #3).
import { parse } from 'node-html-parser';

function attr(el, name) {
  return el ? el.getAttribute(name) : null;
}

// Resolve a possibly-relative URL against the page base.
function absolute(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

// Extract title, description, preview image, and favicon URL from HTML.
// Prefers OpenGraph/Twitter tags, falls back to standard tags.
export function extractMetadata(html, baseUrl) {
  const root = parse(html || '');

  const metaContent = (selector) => {
    const el = root.querySelector(selector);
    return el ? el.getAttribute('content') : null;
  };

  const ogTitle = metaContent('meta[property="og:title"]') || metaContent('meta[name="og:title"]');
  const twTitle = metaContent('meta[name="twitter:title"]');
  const docTitle = root.querySelector('title')?.text?.trim();
  const title = (ogTitle || twTitle || docTitle || '').trim();

  const ogDesc =
    metaContent('meta[property="og:description"]') || metaContent('meta[name="og:description"]');
  const twDesc = metaContent('meta[name="twitter:description"]');
  const metaDesc = metaContent('meta[name="description"]');
  const description = (ogDesc || twDesc || metaDesc || '').trim();

  const ogImage =
    metaContent('meta[property="og:image"]') || metaContent('meta[name="og:image"]');
  const twImage = metaContent('meta[name="twitter:image"]');
  const previewImage = absolute(ogImage || twImage, baseUrl);

  // Favicon: prefer explicit link rels, fall back to /favicon.ico.
  let faviconHref =
    attr(root.querySelector('link[rel="icon"]'), 'href') ||
    attr(root.querySelector('link[rel="shortcut icon"]'), 'href') ||
    attr(root.querySelector('link[rel="apple-touch-icon"]'), 'href');
  let favicon = absolute(faviconHref, baseUrl);
  if (!favicon) favicon = absolute('/favicon.ico', baseUrl);

  return { title, description, previewImage, favicon };
}
