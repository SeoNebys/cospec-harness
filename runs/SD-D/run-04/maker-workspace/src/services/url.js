// URL validation and normalization (FR-041).
//
// Two addresses are the SAME bookmark only when they differ solely by:
//   - host letter case (compared case-insensitively)
//   - a standard default port (80 for http, 443 for https)
//   - a single trailing slash on the path
// Scheme, remaining path, query, and fragment are otherwise compared exactly.
// Query params / fragments are NEVER stripped wholesale; only a specific item on
// the curated known-harmless allow-list may be ignored.

// Curated allow-list of query parameter names known not to change the
// destination. Intentionally conservative (empty by default) so we never merge
// distinct content. Add entries only when proven harmless.
const HARMLESS_QUERY_PARAMS = new Set([]);

// Fragment values known not to change the destination (none by default).
const HARMLESS_FRAGMENTS = new Set([]);

export function isValidUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') return false;
  let u;
  try {
    u = new URL(input.trim());
  } catch {
    return false;
  }
  return u.protocol === 'http:' || u.protocol === 'https:';
}

// Compute the normalized matching key for an address. Throws if not a valid
// http/https URL.
export function normalizeKey(input) {
  if (!isValidUrl(input)) {
    throw new Error('Invalid URL');
  }
  const u = new URL(input.trim());

  // Host: lowercase (URL already lowercases host, but be explicit).
  const host = u.hostname.toLowerCase();

  // Port: drop default port for the scheme.
  let port = u.port;
  if (
    (u.protocol === 'http:' && port === '80') ||
    (u.protocol === 'https:' && port === '443')
  ) {
    port = '';
  }
  const authority = port ? `${host}:${port}` : host;

  // Path: remove at most one trailing slash (but keep root "/").
  let pathname = u.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Query: keep exactly, except drop only known-harmless params. Preserve the
  // original parameter order for a stable key.
  const params = [];
  for (const [key, value] of u.searchParams.entries()) {
    if (HARMLESS_QUERY_PARAMS.has(key)) continue;
    params.push([key, value]);
  }
  const query = params.length
    ? '?' + params.map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join('&')
    : '';

  // Fragment: keep exactly, except drop only known-harmless fragments.
  let fragment = u.hash; // includes leading '#'
  if (fragment && HARMLESS_FRAGMENTS.has(fragment.slice(1))) {
    fragment = '';
  }

  return `${u.protocol}//${authority}${pathname}${query}${fragment}`;
}

// True when the address points to a PDF (used by preservation, FR-032).
export function isPdfUrl(input) {
  try {
    const u = new URL(input);
    return u.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}
