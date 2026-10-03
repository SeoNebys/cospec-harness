// URL validation + canonicalization for duplicate detection (FR-002, FR-006, FR-007).

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

/**
 * Validate that a string is a well-formed http/https web address.
 * Returns the parsed URL object, or null if invalid.
 */
export function parseWebUrl(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname) return null;
  return u;
}

export function isValidWebUrl(input) {
  return parseWebUrl(input) !== null;
}

/**
 * Produce a normalized key so trivially-different addresses collapse to one:
 * - lowercase scheme and host
 * - drop the default port for the scheme
 * - remove a single trailing slash on the path
 * Query string and fragment are preserved (they can distinguish real pages).
 */
export function normalizeUrl(input) {
  const u = parseWebUrl(input);
  if (!u) return null;

  const scheme = u.protocol.toLowerCase();
  const host = u.hostname.toLowerCase();
  const port = u.port && u.port !== DEFAULT_PORTS[scheme] ? `:${u.port}` : '';

  let pathPart = u.pathname || '/';
  if (pathPart.length > 1 && pathPart.endsWith('/')) {
    pathPart = pathPart.slice(0, -1);
  }

  return `${scheme}//${host}${port}${pathPart}${u.search}${u.hash}`;
}

/**
 * Derive a readable fallback title from a URL when no title is available (FR-005).
 */
export function fallbackTitle(input) {
  const u = parseWebUrl(input);
  if (!u) return input;
  const lastSegment = u.pathname.split('/').filter(Boolean).pop();
  if (lastSegment) {
    return decodeURIComponent(lastSegment).replace(/[-_]+/g, ' ').replace(/\.[a-z0-9]+$/i, '');
  }
  return u.hostname;
}
