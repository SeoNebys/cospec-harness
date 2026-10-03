// URL normalization for safe-equivalence deduplication (spec FR-007, research §7).
// Only safe transformations: lower-case host, drop default port.
// Path, query, fragment, and trailing slash are PRESERVED (kept distinct).

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

export function isValidHttpUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') return false;
  let u;
  try {
    u = new URL(input.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (!u.hostname) return false;
  return true;
}

// Compute a canonical dedup key. Throws if the URL is invalid.
export function canonicalKey(input) {
  if (!isValidHttpUrl(input)) {
    throw new Error('Invalid URL');
  }
  const u = new URL(input.trim());
  // Lower-case scheme + host (host is already lower-cased by URL, but be explicit).
  const scheme = u.protocol.toLowerCase();
  const host = u.hostname.toLowerCase();
  // Drop default port only.
  let port = u.port;
  if (port && DEFAULT_PORTS[scheme] === port) port = '';
  const authority = port ? `${host}:${port}` : host;
  // Preserve path (incl. trailing slash), query, and fragment verbatim.
  const path = u.pathname;
  const search = u.search; // includes leading '?', preserves order/tracking params
  const hash = u.hash; // includes leading '#'
  return `${scheme}//${authority}${path}${search}${hash}`;
}

// Derive a display title from the URL when none is provided (FR-004).
export function titleFromUrl(input) {
  try {
    const u = new URL(input.trim());
    const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
    return `${u.hostname}${path}` || input;
  } catch {
    return input;
  }
}
