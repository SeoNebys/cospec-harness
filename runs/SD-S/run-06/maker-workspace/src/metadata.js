import { parse } from 'node-html-parser';

// Derive a readable title from an address when none can be collected (FR-004).
export function titleFromAddress(address) {
  try {
    const u = new URL(address);
    const path = u.pathname.replace(/\/+$/, '');
    const lastSegment = path.split('/').filter(Boolean).pop();
    return lastSegment ? `${u.hostname}${path}` : u.hostname;
  } catch {
    return address;
  }
}

// Resolve a possibly-relative URL against the page's address.
function absolute(base, maybeUrl) {
  if (!maybeUrl) return '';
  try {
    return new URL(maybeUrl, base).href;
  } catch {
    return '';
  }
}

// Extract title/description/icon from a page's HTML (FR-003).
export function extractMetadata(address, html) {
  const root = parse(html);

  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const docTitle = root.querySelector('title')?.text?.trim();
  const title = (ogTitle || docTitle || '').trim();

  const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute('content');
  const ogDesc = root.querySelector('meta[property="og:description"]')?.getAttribute('content');
  const description = (metaDesc || ogDesc || '').trim();

  const iconLink =
    root.querySelector('link[rel="icon"]')?.getAttribute('href') ||
    root.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
    root.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
  const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content');

  let iconUrl = absolute(address, iconLink || ogImage);
  // Fall back to the conventional favicon path at the site root.
  if (!iconUrl) iconUrl = absolute(address, '/favicon.ico');

  return { title, description, iconUrl };
}

// Fetch and parse page metadata. Never throws: on any failure returns empty
// fields so saving is not blocked (FR-004, research Decision 6).
export async function fetchMetadata(address) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(address, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'BookmarkManager/1.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) return { title: '', description: '', iconUrl: '' };
    const html = await res.text();
    return extractMetadata(res.url || address, html);
  } catch {
    return { title: '', description: '', iconUrl: '' };
  }
}
