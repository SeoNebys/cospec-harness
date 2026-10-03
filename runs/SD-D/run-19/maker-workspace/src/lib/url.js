// URL validation and canonical-key normalisation for duplicate detection.

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

/** Validate an http/https URL. Returns a URL object or throws. */
export function parseHttpUrl(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    throw new InvalidUrlError('Not a valid web address');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https addresses are supported');
  }
  if (!u.hostname) throw new InvalidUrlError('Address is missing a host');
  return u;
}

export function isValidHttpUrl(input) {
  try { parseHttpUrl(input); return true; } catch { return false; }
}

/**
 * Canonical key used for duplicate detection: lowercase scheme/host, drop the
 * default port and a trailing slash, keep the query (drop fragment).
 */
export function canonicalKey(input) {
  const u = parseHttpUrl(input);
  const scheme = u.protocol.toLowerCase();
  const host = u.hostname.toLowerCase();
  const port = u.port && u.port !== DEFAULT_PORTS[scheme] ? `:${u.port}` : '';
  let path = u.pathname || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return `${scheme}//${host}${port}${path}${u.search}`;
}

/** Derive a readable title from a URL when no metadata title is available. */
export function deriveTitle(input) {
  try {
    const u = parseHttpUrl(input);
    const path = u.pathname.replace(/\/$/, '');
    return path && path !== '' ? `${u.hostname}${path}` : u.hostname;
  } catch {
    return String(input);
  }
}

export class InvalidUrlError extends Error {
  constructor(message) { super(message); this.name = 'InvalidUrlError'; }
}
