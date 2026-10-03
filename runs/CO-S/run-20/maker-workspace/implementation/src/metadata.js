// Reads a linked page's title, description and site icon (SCN-001).
// Fetching is done server-side because a browser cannot read arbitrary
// cross-origin pages. When a page cannot be read, callers fall back to manual
// entry (SCN-006) — this module signals that with { ok: false }.

/** Host without a leading "www." — used as a title fallback. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return '';
}

/**
 * Extract { title, description, favicon } from raw HTML.
 * Pure and synchronous so it can be unit-tested without the network.
 */
export function parseMetadata(html, baseUrl) {
  const source = String(html || '');
  const title =
    metaContent(source, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) || hostOf(baseUrl);

  const description = metaContent(source, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
  ]);

  let favicon = '';
  const iconMatch =
    source.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
    source.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);
  try {
    favicon = iconMatch ? new URL(iconMatch[1], baseUrl).href : new URL('/favicon.ico', baseUrl).href;
  } catch {
    favicon = '';
  }

  return { title: title.trim(), description: description.trim(), favicon };
}

/**
 * Fetch a URL and return { ok, title, description, favicon }.
 * Never throws: on any failure returns { ok: false } so the caller can offer
 * manual entry (SCN-006).
 */
export async function fetchMetadata(url, { timeoutMs = 6000, fetchImpl = fetch } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'MyBookmarks/1.0 (+link-preview)' },
    });
    if (!res.ok) return { ok: false };
    const html = await res.text();
    const meta = parseMetadata(html, res.url || url);
    return { ok: true, ...meta };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
