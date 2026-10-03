// URL validation and normalization for the bookmark manager.
// Validation: only well-formed http/https URLs are accepted (FR-002).
// Normalization: produce a canonical form used to detect duplicates (FR-013).

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

/**
 * Validate and parse a bookmark URL.
 * @param {unknown} raw
 * @returns {{ ok: true, url: string, urlNorm: string } | { ok: false, error: string }}
 */
export function parseBookmarkUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'Please enter a web address.' };
  }
  const trimmed = raw.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'That is not a valid web address.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https addresses can be saved.' };
  }
  return { ok: true, url: trimmed, urlNorm: normalize(parsed) };
}

/**
 * Build the normalized comparison form: lowercase scheme + host, drop the
 * default port, and remove a single trailing slash from the path.
 * @param {URL} parsed
 */
function normalize(parsed) {
  const scheme = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const port =
    parsed.port && parsed.port !== DEFAULT_PORTS[scheme] ? `:${parsed.port}` : '';
  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (path === '/') {
    path = '';
  }
  return `${scheme}//${host}${port}${path}${parsed.search}`;
}
