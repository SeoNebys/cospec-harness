// URL normalization, validation, and title-fallback helpers.
// See specs/001-bookmark-manager/research.md and data-model.md.

/**
 * Normalize a raw address into a canonical http(s) URL string.
 * Assumes https:// when no scheme is supplied (edge case in the spec).
 * Returns null when the input cannot form a valid http/https URL.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (value === '') return null;

  // Assume a scheme when none is present (e.g. "example.com/x").
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
    value = `https://${value}`;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;

  return parsed.toString();
}

/**
 * Whether a raw address is a usable http/https URL after normalization.
 * @param {string} raw
 * @returns {boolean}
 */
export function isValidUrl(raw) {
  return normalizeUrl(raw) !== null;
}

/**
 * Derive a readable fallback title from a URL's host and path.
 * Used when the user provides no title and the page cannot be fetched.
 * @param {string} normalizedUrl
 * @returns {string}
 */
export function fallbackTitle(normalizedUrl) {
  try {
    const u = new URL(normalizedUrl);
    const path = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/+$/, '') : '';
    return `${u.hostname}${path}` || normalizedUrl;
  } catch {
    return normalizedUrl;
  }
}

/**
 * Best-effort, time-bounded fetch of a page's <title>.
 * Never throws: returns null on any failure or timeout so saving still succeeds.
 * @param {string} normalizedUrl
 * @param {number} timeoutMs
 * @returns {Promise<string|null>}
 */
export async function fetchPageTitle(normalizedUrl, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const title = match[1].replace(/\s+/g, ' ').trim();
    return title || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
