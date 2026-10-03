import { parse } from 'node-html-parser';

// Fetch the target page and extract its <title>. On any failure (unreachable
// page, timeout, non-HTML, missing title) fall back to the address itself so a
// save always succeeds with a usable title (FR-003).
export async function deriveTitle(url, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+title-fetch)' },
    });
    if (!res.ok) return url;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return url;

    const html = await res.text();
    const root = parse(html);
    const titleEl = root.querySelector('title');
    const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';
    return title || url;
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}
