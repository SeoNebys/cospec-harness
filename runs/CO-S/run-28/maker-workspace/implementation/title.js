// Server-side page-title retrieval (SCN-001), with a fallback to the address
// when the title cannot be read (SCN-009). Runs server-side so it is not blocked
// by browser cross-origin rules.

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, (m) => ENTITIES[m] || m);
}

/** Extract the contents of the first <title> element. */
export function parseTitle(html) {
  const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return decodeEntities(m[1].replace(/\s+/g, ' ').trim());
}

/**
 * Fetch a URL and return its page title. On any failure (network, timeout,
 * blocked, no title) returns the URL itself so saving is never blocked (SCN-009).
 * `fetchImpl` is injectable for testing.
 */
export async function fetchTitle(url, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'BookmarkApp/1.0 (+personal bookmark manager)' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res || !res.ok) return url;
    const html = await res.text();
    const title = parseTitle(html);
    return title || url;
  } catch {
    return url;
  }
}
